import type { ArticleDesign } from '../styles';

export type ArticleColorRecipe = {
    text: string;
    muted: string;
    surface: string;
    line: string;
    quote: string;
    mark: string;
    secondary: string;
};

// Pair the existing paper / primary anchors with a complete supporting palette.
// Neutrals share the palette's temperature; large surfaces are quieter than marks.
// Graphic styles reuse their secondary hue instead of adding another large color.
export const articleColorRecipes: Record<ArticleDesign, ArticleColorRecipe> = {
    cotton: { text: '#525252', muted: '#667168', surface: '#f5f6f3', line: '#dfe4df', quote: '#f5f6f3', mark: '#dee6dc', secondary: '#8a978b' },
    idea: { text: '#343531', muted: '#686456', surface: '#efeadb', line: '#d8cdb4', quote: '#f4e7be', mark: '#f4dda0', secondary: '#caa34f' },
    log: { text: '#293b3c', muted: '#556868', surface: '#eaf1ef', line: '#c6d8d2', quote: '#eaf1ef', mark: '#cce1d9', secondary: '#86aba0' },
    brief: { text: '#2e3944', muted: '#5b6b7b', surface: '#edf2f7', line: '#cbd8e5', quote: '#edf2f7', mark: '#d6e3ef', secondary: '#8aa7c1' },
    brand: { text: '#382f30', muted: '#706162', surface: '#f7f1e7', line: '#e0d2bc', quote: '#faf6ef', mark: '#edddb6', secondary: '#a9874f' },
    research: { text: '#38362f', muted: '#686155', surface: '#f3efe5', line: '#d8d0bf', quote: '#f3efe5', mark: '#e8dfc7', secondary: '#a28e6d' },
    portrait: { text: '#403d38', muted: '#6a635b', surface: '#eeeee7', line: '#d4d1c6', quote: '#f1efe8', mark: '#dce2d6', secondary: '#8c9b87' },
    column: { text: '#37332f', muted: '#6e625a', surface: '#fbf0e7', line: '#e8d5c7', quote: '#fbf0e7', mark: '#f3d9c5', secondary: '#cd9a73' },
    weekend: { text: '#493b35', muted: '#785f54', surface: '#f8e9de', line: '#ebcebd', quote: '#f8e9de', mark: '#f3d4be', secondary: '#d59b78' },
    culture: { text: '#43372e', muted: '#736150', surface: '#f6ebd6', line: '#e0c9a1', quote: '#f6ebd6', mark: '#ecd8a4', secondary: '#b39151' },
    neo: { text: '#202020', muted: '#656052', surface: '#e3edf4', line: '#202020', quote: '#fff0b5', mark: '#f9db59', secondary: '#b1d5ee' },
    pixel: { text: '#d9deed', muted: '#a7b4c9', surface: '#1c2330', line: '#37435a', quote: '#1c2330', mark: '#a5ddc4', secondary: '#dfa0bd' },
};
