// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VIDEO EXPORT — export/video.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function verifiedVideoPipeline(vid, grp){
  if(!vid || typeof vid !== 'string') return getFallbackVid(null, grp||'default');
  // Strip accidental full URLs — extract video ID if passed as URL
  let v = vid.trim();
  // Reject full URLs that sneak through — extract ID from watch?v= pattern
  const watchMatch = v.match(/[?&]v=([A-Za-z0-9_-]{8,12})/);
  if(watchMatch) v = watchMatch[1];
  // Reject youtu.be short links
  const youtubeShortMatch = v.match(/youtu\.be\/([A-Za-z0-9_-]{8,12})/);
  if(youtubeShortMatch) v = youtubeShortMatch[1];
  // Reject embed URLs
  if(v.includes('/embed/') || v.includes('youtube.com') || v.includes('youtu.be')) {
    return getFallbackVid(null, grp||'default');
  }
  // Immediately reject known-bad: meme vids, short invalid IDs, etc.
  if(v.length < 8 || v.length > 12) return getFallbackVid(v, grp||'default');
  if(_vidBlacklist.has(v)) return getFallbackVid(v, grp||'default');
  // Reject IDs explicitly marked false in VERIFIED_VIDS
  if(VERIFIED_VIDS[v] === false){
    _vidBlacklist.add(v);
    return getFallbackVid(v, grp||'default');
  }
  // If runtime cache says it's bad, blacklist and fallback
  if(_vidCache[v] === false){
    _vidBlacklist.add(v);
    return getFallbackVid(v, grp||'default');
  }
  // If it's in our verified list, trust it
  if(VERIFIED_VIDS[v]) return v;
  // If not yet validated but not blacklisted, fire async check, return optimistically
  checkVideoAvailable(v).then(ok=>{ if(!ok) _vidBlacklist.add(v); });
  // Return original — if async check fails, next render will use fallback
  return v;
}

// Safe video URL — always returns a valid watch?v= YouTube URL (mobile-safe, embeddable, no Shorts)
// ONLY format allowed: https://www.youtube.com/watch?v=VIDEO_ID
function safeVidUrl(vid, grp){
  const resolvedVid = verifiedVideoPipeline(vid, grp||'default');
  // Final safety net: never allow Shorts, playlists, or embed in output URL
  if(!resolvedVid || resolvedVid.includes('/') || resolvedVid.includes('?') || resolvedVid.includes('&')) {
    return 'https://www.youtube.com/watch?v=' + VID_ULTIMATE_FALLBACK;
  }
  return 'https://www.youtube.com/watch?v=' + resolvedVid;
}

