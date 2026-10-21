#!/usr/bin/env python3
"""Check standalone article HTML and fenced-code preservation; no third-party dependencies."""

import argparse
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
VISIBLE = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'pre', 'code', 'span', 'strong', 'em', 'b', 'i', 'a', 'mark', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption', 'sup', 'sub', 'hr'}
FORBIDDEN = {'script', 'style', 'link', 'iframe', 'object', 'embed', 'base'}


def fenced_code(text):
    blocks = []
    marker = None
    width = 0
    lines = []
    for line in text.splitlines():
        if marker is None:
            match = re.match(r'^ {0,3}(`{3,}|~{3,})(.*)$', line)
            if match:
                marker = match[1][0]
                width = len(match[1])
                lines = []
        elif re.fullmatch(r' {0,3}' + re.escape(marker) + '{' + str(width) + r',}\s*', line):
            blocks.append('\n'.join(lines))
            marker = None
        else:
            lines.append(line)
    if marker is not None:
        raise ValueError('Markdown 有未关闭的代码围栏')
    return blocks


class ArticleChecker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []
        self.codes = []
        self.active_pre = None
        self.pre_code_depth = None
        self.code_parts = []
        self.has_code_child = False
        self.title = []
        self.body_h1 = 0
        self.paragraphs = 0
        self.body_seen = False
        self.charset = False
        self.viewport = False

    def error(self, message):
        self.errors.append('HTML 第 {} 行：{}'.format(self.getpos()[0], message))

    def handle_starttag(self, tag, pairs):
        attrs = dict(pairs)
        if tag == 'body':
            self.body_seen = True
        if tag == 'meta':
            if attrs.get('charset', '').lower() == 'utf-8':
                self.charset = True
            if attrs.get('name', '').lower() == 'viewport':
                self.viewport = True
        if tag in FORBIDDEN:
            self.error('禁止的元素 <{}>'.format(tag))
        if {'class', 'id'}.intersection(attrs):
            self.error('正式正文不应依赖 class 或 id')
        if any(k.lower().startswith('on') for k in attrs):
            self.error('发现事件处理属性')
        if {'src', 'srcset', 'href', 'data', 'poster', 'background'}.intersection(attrs):
            self.error('发现资源或活动链接属性；地址应按发布规则作为文字呈现')
        style = attrs.get('style', '')
        if re.search(r'url\s*\(|@import|expression\s*\(|javascript:|position\s*:\s*fixed', style, re.I):
            self.error('样式包含外部资源或不支持的动态能力')
        if 'body' in self.stack and tag in VISIBLE:
            declarations = {}
            for declaration in style.split(';'):
                if ':' in declaration:
                    key, value = declaration.split(':', 1)
                    declarations[key.strip().lower()] = value.strip().lower()
            for key in ('font-size', 'line-height', 'color'):
                if not declarations.get(key) or declarations[key] in {'inherit', 'unset'}:
                    self.error('<{}> 缺少独立的 {}'.format(tag, key))
            if tag == 'p':
                self.paragraphs += 1
            if tag == 'h1':
                self.body_h1 += 1
        if tag == 'pre':
            if self.active_pre is not None:
                self.error('代码块发生嵌套')
            self.active_pre = []
            self.code_parts = []
            self.has_code_child = False
        if tag == 'code' and self.active_pre is not None:
            self.pre_code_depth = len(self.stack)
            self.has_code_child = True
        if tag not in VOID:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack or self.stack[-1] != tag:
            self.error('标签闭合不匹配 </{}>'.format(tag))
            return
        if tag == 'code' and self.pre_code_depth == len(self.stack) - 1:
            self.pre_code_depth = None
        if tag == 'pre' and self.active_pre is not None:
            self.codes.append(''.join(self.code_parts if self.has_code_child else self.active_pre))
            self.active_pre = None
            self.pre_code_depth = None
        self.stack.pop()

    def handle_data(self, data):
        if 'title' in self.stack:
            self.title.append(data)
        if self.active_pre is not None:
            self.active_pre.append(data)
            if self.pre_code_depth is not None:
                self.code_parts.append(data)


def check(markdown, html, body_title=False):
    checker = ArticleChecker()
    checker.feed(html)
    checker.close()
    errors = list(checker.errors)
    if checker.stack:
        errors.append('HTML 标签未关闭：' + ', '.join(checker.stack))
    if not checker.body_seen or not checker.paragraphs:
        errors.append('缺少正文或正文段落')
    if not checker.charset or not checker.viewport:
        errors.append('缺少 UTF-8 charset 或 viewport')
    if not body_title and checker.body_h1:
        errors.append('公众号正文出现一级标题，可能造成双标题')
    title_match = re.match(r'\A(?:---\s*\n[\s\S]*?\n---\s*\n)?\s*#\s+(.+)', markdown)
    if title_match:
        expected_title = title_match[1].strip()
        if expected_title != ''.join(checker.title).strip():
            errors.append('首个 Markdown 标题与 HTML title 不一致')
    try:
        expected_codes = fenced_code(markdown)
        if len(expected_codes) != len(checker.codes):
            errors.append('代码块数量改变：Markdown {}，HTML {}'.format(len(expected_codes), len(checker.codes)))
        else:
            for index, (expected, actual) in enumerate(zip(expected_codes, checker.codes), 1):
                # One terminal newline is normal HTML code serialization, never remove other whitespace.
                if actual != expected and actual != expected + '\n':
                    errors.append('第 {} 个代码块的字符或换行发生变化'.format(index))
    except ValueError as exc:
        errors.append(str(exc))
    return {'ok': not errors, 'paragraphs': checker.paragraphs, 'code_blocks': len(checker.codes), 'errors': errors,
            'limits': '仅检查结构和代码一致性；不验证编辑语义、浏览器外观、接口调用或微信发布效果。'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('markdown', type=Path)
    parser.add_argument('html', type=Path)
    parser.add_argument('--body-title', action='store_true', help='允许正文一级标题')
    args = parser.parse_args()
    try:
        result = check(args.markdown.read_text(encoding='utf-8'), args.html.read_text(encoding='utf-8'), args.body_title)
    except (OSError, UnicodeError) as exc:
        print('无法读取交付文件：' + str(exc), file=sys.stderr)
        return 2
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
