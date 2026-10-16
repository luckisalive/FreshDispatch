// server/src/services/evidenceBuilder.js

/**
 * Constructs evidence items with aiSummary and builds a deduplicated sourcePanel.
 * Discards any supportIndex not in presentMarkers.
 * Auto-corrects verdicts to "Unverified" if required evidence is missing.
 *
 * @param {object} structuredResult The parsed JSON from Call 2
 * @param {object} groundingMetadata The groundingMetadata from Call 1
 * @param {Set<number>} presentMarkers The set of chunk indices actually present as markers in Call 1 text
 * @returns {object} Assembled and enforced verification result
 */
export function buildEvidence(structuredResult, groundingMetadata, presentMarkers) {
  if (!structuredResult || !Array.isArray(structuredResult.claims)) {
    return { claims: [], sourcePanel: [], nonCheckableReason: 'Invalid structure received.' };
  }

  const chunks = groundingMetadata?.groundingChunks ?? [];
  const supports = groundingMetadata?.groundingSupports ?? [];

  // Map each chunk index to an array of support segment texts
  const chunkSnippets = new Map();
  for (const s of supports) {
    const text = s.segment?.text;
    if (!text) continue;
    for (const idx of (s.groundingChunkIndices ?? [])) {
      if (!chunkSnippets.has(idx)) chunkSnippets.set(idx, []);
      chunkSnippets.get(idx).push(text);
    }
  }

  const citedChunkIndices = new Set();

  for (const claim of structuredResult.claims) {
    const rawIndices = Array.isArray(claim.supportIndices) ? claim.supportIndices : [];

    // Strict validation: index must be a number, present in presentMarkers, and backed by a real chunk with a URI
    const validIndices = rawIndices.filter(idx =>
      typeof idx === 'number' &&
      presentMarkers.has(idx) &&
      chunks[idx]?.web?.uri
    );

    claim.evidence = validIndices.map(idx => {
      citedChunkIndices.add(idx);
      const chunk = chunks[idx].web;
      const summaries = chunkSnippets.get(idx) || [];
      const aiSummary = summaries.join(' ').trim().substring(0, 500) ||
        `Google Search grounding identified this source (${chunk.title || 'Source'}) in support of the analysis.`;

      return {
        sourceName: chunk.title || `Source ${idx + 1}`,
        url: chunk.uri,
        aiSummary,
      };
    });

    // Enforce: non-Unverified verdict MUST have surviving evidence
    const needsEvidence = ['Supported', 'Contradicted', 'Mixed'];
    if (needsEvidence.includes(claim.verdict) && claim.evidence.length === 0) {
      claim.wasAutoCorrected = true;
      claim.originalVerdict = claim.verdict;
      claim.verdict = 'Unverified';
      claim.limitations = (claim.limitations ? claim.limitations + ' ' : '') +
        '[Auto-corrected: claim lacked verified source attribution from search grounding.]';
    } else {
      claim.wasAutoCorrected = false;
      claim.originalVerdict = claim.verdict;
    }

    // supportIndices was used for internal mapping; remove before client delivery
    delete claim.supportIndices;
  }

  // Build deduplicated sourcePanel: only sources cited by at least one claim
  const seenUrls = new Set();
  const sourcePanel = [];

  for (const idx of citedChunkIndices) {
    const chunk = chunks[idx]?.web;
    if (chunk?.uri && !seenUrls.has(chunk.uri)) {
      seenUrls.add(chunk.uri);
      sourcePanel.push({
        title: chunk.title || 'Untitled Source',
        url: chunk.uri,
      });
    }
  }

  structuredResult.sourcePanel = sourcePanel;
  return structuredResult;
}
