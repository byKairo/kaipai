/** Compare the actual Worker build identity with the commit that Actions deployed. */
async function verifyDeployedRelease(expected = process.env.GITHUB_SHA) {
  if (!/^[a-f0-9]{40}$/.test(expected || '')) throw new Error('A full GitHub source SHA is required');
  let last;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await fetch('https://kaipai.kairostudio.workers.dev/api/release', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (response.ok && data.channel === 'github-main' && data.commit === expected) {
        console.log(`Production source verified: ${data.commit} (github-main)`);
        return;
      }
      last = new Error('Production source has not switched to the deployed commit yet');
    } catch (error) { last = error; }
    if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 3000));
  }
  throw last;
}
module.exports = { verifyDeployedRelease };
if (require.main === module) verifyDeployedRelease().catch(error => { console.error(error.message); process.exitCode = 1; });
