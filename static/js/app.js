/**
 * Kisan Web Project - Main Frontend Application Orchestrator
 * Coordinates Seasonal Crops Guide, Geolocation Crop Recommendation,
 * Agricultural Machinery Hub, Government Schemes Portal, and Auth State.
 */

(function () {
  'use strict';

  // -------------------------------------------------------------
  // 1. Seasonal Crops Guide & Workflow Roadmap
  // -------------------------------------------------------------
  let allCrops = [];

  async function loadCrops(season = 'all') {
    const container = document.getElementById('crops-grid-container');
    if (!container) return;

    container.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-400">
        <svg class="animate-spin h-8 w-8 text-emerald-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading comprehensive crop lifecycle workflows...</span>
      </div>
    `;

    try {
      const url = season === 'all' ? '/api/crops' : `/api/crops?season=${season}`;
      const res = await fetch(url);
      const data = await res.json();
      allCrops = data.crops || [];

      renderCropCards(allCrops);
    } catch (err) {
      console.error('Error fetching crops:', err);
    }
  }

  function renderCropCards(crops) {
    const container = document.getElementById('crops-grid-container');
    if (!container) return;

    container.innerHTML = '';
    if (crops.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-12 text-slate-400 glass-card rounded-2xl p-8">
          No crops listed for this season.
        </div>
      `;
      return;
    }

    crops.forEach((crop) => {
      const card = document.createElement('div');
      card.className = 'glass-card tilt-card rounded-2xl overflow-hidden flex flex-col justify-between border border-emerald-500/15 group';

      const seasonBadgeColors = {
        rabi: 'badge-glow-amber',
        kharif: 'badge-glow-cyan',
        zaid: 'badge-glow-green',
        summer: 'badge-glow-amber',
      };
      const badgeClass = seasonBadgeColors[crop.season] || 'badge-glow-green';

      card.innerHTML = `
        <div class="tilt-glare"></div>
        <div class="tilt-content flex-1 flex flex-col justify-between">
          <div>
            <div class="relative h-48 overflow-hidden bg-black/40">
              <img src="${crop.image_url}" alt="${crop.name}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              <span class="absolute top-3 left-3 px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${badgeClass}">
                ${crop.season} Season
              </span>
              <span class="absolute bottom-3 right-3 text-xs bg-black/60 px-2 py-0.5 rounded backdrop-blur text-emerald-300 font-mono">
                ⏱ ${crop.growth_duration_days} Days
              </span>
            </div>

            <div class="p-5">
              <div class="flex items-baseline justify-between mb-1">
                <h3 class="text-lg font-bold text-white">${crop.name}</h3>
              </div>
              <p class="text-xs text-emerald-400/90 italic mb-3">${crop.scientific_name || ''}</p>

              <div class="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-white/5 p-3 rounded-xl mb-4">
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase">Climate Range</span>
                  <span class="font-semibold text-white">${crop.climate.temp_min}° - ${crop.climate.temp_max}°C</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase">Soil Preference</span>
                  <span class="font-semibold text-white truncate block" title="${crop.climate.soil_type}">${crop.climate.soil_type}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase">Avg Yield / Acre</span>
                  <span class="font-semibold text-emerald-300">${crop.estimated_yield_per_acre || 'High'}</span>
                </div>
                <div>
                  <span class="text-slate-400 block text-[10px] uppercase">Est. Market Rate</span>
                  <span class="font-semibold text-amber-300">${crop.market_price_range || 'Market Value'}</span>
                </div>
              </div>

              <!-- Top Hybrids Tag List -->
              <div class="mb-4">
                <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Top Hybrid Seeds</span>
                <div class="flex flex-wrap gap-1.5">
                  ${crop.hybrid_varieties.slice(0, 3).map((h) => `<span class="px-2 py-0.5 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 rounded text-[11px] font-medium">${h}</span>`).join('')}
                </div>
              </div>
            </div>
          </div>

          <div class="p-5 pt-0">
            <button onclick="window.openCropWorkflowModal(${crop.id})" class="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
              View Step-by-Step Farming Roadmap
            </button>
          </div>
        </div>
      `;

      container.appendChild(card);
    });

    if (window.init3DTilt) window.init3DTilt();
  }

  // Crop Workflow Modal
  window.openCropWorkflowModal = function (cropId) {
    const crop = allCrops.find((c) => c.id === cropId);
    if (!crop) return;

    const modal = document.getElementById('crop-workflow-modal');
    const titleEl = document.getElementById('workflow-modal-title');
    const seasonEl = document.getElementById('workflow-modal-season');
    const timelineEl = document.getElementById('workflow-timeline-steps');
    const videoContainer = document.getElementById('workflow-video-container');

    if (titleEl) titleEl.textContent = `${crop.name} Farming Lifecycle Workflow`;
    if (seasonEl) seasonEl.textContent = `${crop.season.toUpperCase()} SEASON • ${crop.growth_duration_days} DAYS FROM SEED TO HARVEST`;

    // Render step-by-step roadmap
    if (timelineEl) {
      timelineEl.innerHTML = '';
      (crop.workflow_steps || []).forEach((st, idx) => {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'relative pl-8 pb-6 last:pb-0 border-l-2 border-emerald-500/30 ml-4';

        stepDiv.innerHTML = `
          <div class="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center ring-4 ring-slate-900 shadow">
            ${st.step || idx + 1}
          </div>
          <div class="bg-black/30 border border-white/10 rounded-xl p-4 ml-2">
            <div class="flex items-center justify-between mb-1">
              <h4 class="text-sm font-bold text-white">${st.title}</h4>
              <span class="text-[11px] font-semibold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/20">${st.timing || `Phase ${st.step}`}</span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">${st.desc}</p>
          </div>
        `;
        timelineEl.appendChild(stepDiv);
      });
    }

    // Embed YouTube tutorial if available
    // Farming tutorial link
if (videoContainer) {
  const youtubeSearchUrl =
    'https://www.youtube.com/results?search_query=' +
    encodeURIComponent(`${crop.name} farming tutorial India`);

  videoContainer.innerHTML = `
    <div class="bg-black/30 border border-white/10 rounded-xl p-5 text-center">
      <p class="text-sm text-slate-300 mb-4">
        Watch practical farming tutorials for ${crop.name}.
      </p>

      <a
        href="${youtubeSearchUrl}"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center justify-center gap-2 px-5 py-2.5
               bg-red-600 hover:bg-red-500 text-white font-semibold
               text-sm rounded-xl transition-all shadow-lg"
      >
        ▶ Watch Farming Tutorial on YouTube
      </a>
    </div>
  `;

  videoContainer.classList.remove('hidden');
}

    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeCropWorkflowModal = function () {
    const modal = document.getElementById('crop-workflow-modal');
    const videoContainer = document.getElementById('workflow-video-container');
    if (videoContainer) videoContainer.innerHTML = '';
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  // -------------------------------------------------------------
  // 2. Smart Location-Based Crop & Hybrid Recommender
  // -------------------------------------------------------------
  async function triggerSmartRecommendation() {
  const resultsContainer = document.getElementById('recommendation-results-container');
  const btn = document.getElementById('btn-run-recommendation');
  const loadingPanel = document.getElementById('crop-advisor-loading');
  const resultsHeader = document.getElementById('crop-advisor-results-header');
  const analysisSource = document.getElementById('crop-advisor-analysis-source');

  if (!resultsContainer) return;

  const soilType = document.getElementById('soil-selector')?.value || 'Loamy';
  const season = document.getElementById('advisor-season')?.value || 'Auto';
  const waterAvailability = document.getElementById('advisor-water')?.value || 'Moderate';
  const irrigation = document.getElementById('advisor-irrigation')?.value || 'Rain-fed';
  const landSizeValue = document.getElementById('advisor-land-size')?.value;
  const priority = document.getElementById('advisor-priority')?.value || 'Balanced';

  const payload = {
    soil_type: soilType,
    season: season,
    water_availability: waterAvailability,
    irrigation: irrigation,
    land_size: landSizeValue ? Number(landSizeValue) : null,
    priority: priority,

    location: window.userLocation?.locationName || 'Unknown',

    temperature:
      window.userLocation?.temperature !== undefined
        ? window.userLocation.temperature
        : null,

    humidity:
      window.userLocation?.humidity !== undefined
        ? window.userLocation.humidity
        : null,

    rainfall:
      window.userLocation?.rainfall !== undefined
        ? window.userLocation.rainfall
        : null,
  };

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10"
          stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
        </path>
      </svg>
      AI is analyzing your farm...
    `;
  }

  if (loadingPanel) {
    loadingPanel.classList.remove('hidden');
  }

  if (resultsHeader) {
    resultsHeader.classList.add('hidden');
  }

  resultsContainer.classList.add('hidden');
  resultsContainer.innerHTML = '';

  try {
    const resp = await fetch('/api/ai/crop-advisor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(
        data.error ||
        data.details ||
        'AI Crop Advisor failed.'
      );
    }

    if (analysisSource) {
      analysisSource.textContent =
        data.analysis_source === 'gemini-api'
          ? 'Google Gemini AI'
          : data.analysis_source === 'ollama-qwen2.5vl'
          ? 'Local AI • Qwen2.5-VL'
          : data.analysis_source || 'AI Analysis';
    }

    renderRecommendationResults(data);

    if (resultsHeader) {
      resultsHeader.classList.remove('hidden');
    }

    if (window.showToast) {
      window.showToast(
        'AI crop recommendations generated successfully.',
        'success'
      );
    }

  } catch (err) {
    console.error('AI Crop Advisor error:', err);

    resultsContainer.innerHTML = `
      <div class="col-span-full glass-card rounded-2xl p-6 border border-red-500/30 text-center">
        <div class="text-red-400 font-bold mb-2">
          Unable to generate AI recommendations
        </div>
        <p class="text-sm text-slate-300">
          ${err.message || 'Please try again.'}
        </p>
      </div>
    `;

    resultsContainer.classList.remove('hidden');

    if (window.showToast) {
      window.showToast(
        err.message || 'AI Crop Advisor failed.',
        'error'
      );
    }

  } finally {
    if (loadingPanel) {
      loadingPanel.classList.add('hidden');
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Get AI Crop Recommendations';
    }
  }
}

  function renderRecommendationResults(data) {
  const resultsContainer = document.getElementById('recommendation-results-container');
  if (!resultsContainer) return;

  resultsContainer.innerHTML = '';

  const recs = data.recommendations || [];

  if (!Array.isArray(recs) || recs.length === 0) {
    resultsContainer.innerHTML = `
      <div class="col-span-full glass-card rounded-2xl p-6 border border-amber-500/30 text-center">
        <div class="text-amber-400 font-bold mb-2">
          No recommendations available
        </div>
        <p class="text-sm text-slate-300">
          The AI could not identify suitable crops from the supplied conditions.
        </p>
      </div>
    `;

    resultsContainer.classList.remove('hidden');
    return;
  }

  const summaryCard = document.createElement('div');
  summaryCard.className =
    'col-span-full glass-card rounded-2xl p-5 border border-cyan-500/20';

  summaryCard.innerHTML = `
    <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
      <div>
        <div class="text-xs uppercase tracking-wider text-cyan-400 font-bold mb-2">
          AI Farm Assessment
        </div>

        <p class="text-sm text-slate-300 leading-relaxed">
          ${data.analysis_summary || 'Recommendations generated from the supplied farm conditions.'}
        </p>
      </div>

      <div class="shrink-0">
        <span class="inline-flex px-3 py-1 rounded-full text-xs font-semibold
          bg-emerald-950/50 border border-emerald-500/30 text-emerald-300">
          Season: ${data.season_used || 'Context-based'}
        </span>
      </div>
    </div>
  `;

  resultsContainer.appendChild(summaryCard);

  recs.forEach((rec, idx) => {
    const card = document.createElement('div');

    card.className =
      'glass-card tilt-card p-5 rounded-2xl flex flex-col justify-between border border-emerald-500/20';

    const risk = rec.risk_level || 'Moderate';

    let riskClass = 'text-amber-300';

    if (risk.toLowerCase() === 'low') {
      riskClass = 'text-emerald-300';
    } else if (risk.toLowerCase() === 'high') {
      riskClass = 'text-red-400';
    }

    const advantages = Array.isArray(rec.key_advantages)
      ? rec.key_advantages
      : [];

    card.innerHTML = `
      <div class="tilt-glare"></div>

      <div class="tilt-content">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold text-emerald-400 bg-emerald-950/40
            px-2.5 py-1 rounded-full border border-emerald-500/30">
            Rank #${rec.rank || idx + 1}
          </span>

          <span class="text-sm font-black text-amber-400">
            ${rec.suitability_score ?? 0}% Match
          </span>
        </div>

        <h4 class="text-lg font-bold text-white mb-2">
          ${rec.crop_name || 'Crop'}
        </h4>

        <p class="text-xs text-slate-300 leading-relaxed mb-4">
          ${rec.reason || ''}
        </p>

        <div class="bg-black/20 p-3 rounded-xl space-y-2 text-xs text-slate-300 mb-4">

          <div class="flex justify-between gap-4">
            <span class="text-slate-400">Season</span>
            <span class="font-semibold text-emerald-300">
              ${rec.season || 'Unknown'}
            </span>
          </div>

          <div class="flex justify-between gap-4">
            <span class="text-slate-400">Water Need</span>
            <span class="font-semibold text-cyan-300">
              ${rec.water_requirement || 'Unknown'}
            </span>
          </div>

          <div class="flex justify-between gap-4">
            <span class="text-slate-400">Crop Duration</span>
            <span class="font-semibold text-white text-right">
              ${rec.duration_days || 'Unknown'}
            </span>
          </div>

          <div class="flex justify-between gap-4">
            <span class="text-slate-400">Risk Level</span>
            <span class="font-semibold ${riskClass}">
              ${risk}
            </span>
          </div>

          <div class="flex justify-between gap-4">
            <span class="text-slate-400">Expected Yield</span>
            <span class="font-semibold text-white text-right">
              ${rec.expected_yield || 'Local estimate required'}
            </span>
          </div>

        </div>

        ${
          advantages.length > 0
            ? `
          <div class="mb-4">
            <div class="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Key Advantages
            </div>

            <div class="flex flex-wrap gap-1.5">
              ${advantages
                .map(
                  (adv) => `
                    <span class="px-2 py-1 bg-emerald-950/50
                      border border-emerald-500/20 text-emerald-300
                      rounded-lg text-[10px]">
                      ${adv}
                    </span>
                  `
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }

        <div class="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3">
          <div class="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-1">
            Important Caution
          </div>

          <p class="text-xs text-slate-300 leading-relaxed">
            ${rec.important_caution || 'Verify local conditions before planting.'}
          </p>
        </div>
      </div>
    `;

    resultsContainer.appendChild(card);
  });

  resultsContainer.classList.remove('hidden');

  if (window.init3DTilt) {
    window.init3DTilt();
  }
}

  // -------------------------------------------------------------
  // 3. Agricultural Tools & Machinery Hub
  // -------------------------------------------------------------
  async function loadMachineryTools(category = 'all') {
    const container = document.getElementById('tools-grid-container');
    if (!container) return;

    try {
      const url = category === 'all' ? '/api/tools' : `/api/tools?category=${category}`;
      const res = await fetch(url);
      const data = await res.json();
      const tools = data.tools || [];

      container.innerHTML = '';
      tools.forEach((tool) => {
        const card = document.createElement('div');
        card.className = 'glass-card tilt-card rounded-2xl overflow-hidden flex flex-col justify-between border border-emerald-500/15';

        const specsEntries = Object.entries(tool.specs || {}).slice(0, 4);

        card.innerHTML = `
          <div class="tilt-glare"></div>
          <div class="tilt-content flex-1 flex flex-col justify-between">
            <div>
              <div class="relative h-44 overflow-hidden bg-black/40">
                <img src="${tool.image_url}" alt="${tool.name}" class="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <span class="absolute top-3 right-3 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-full badge-glow-green">
                  ${tool.category}
                </span>
              </div>

              <div class="p-5">
                <h3 class="text-base font-bold text-white mb-1">${tool.name}</h3>
                <p class="text-xs text-slate-300 line-clamp-2 mb-3">${tool.description || ''}</p>

                <!-- Technical Specs Box -->
                <div class="bg-black/30 border border-white/5 rounded-xl p-3 mb-3 text-xs space-y-1.5">
                  ${specsEntries.map(([k, v]) => `
                    <div class="flex justify-between">
                      <span class="text-slate-400 text-[11px]">${k}:</span>
                      <span class="font-semibold text-slate-200 text-right truncate max-w-[150px]">${v}</span>
                    </div>
                  `).join('')}
                </div>

                <div class="flex items-center justify-between text-xs text-slate-300">
                  <span class="text-amber-400 font-bold">${tool.price_range}</span>
                  <span class="text-[10px] text-emerald-400 font-medium">${tool.subsidy_available}</span>
                </div>
              </div>
            </div>

            <div class="p-5 pt-0 flex gap-2">
              <button onclick="window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent('${tool.name} agricultural machinery demonstration'), '_blank', 'noopener,noreferrer')" class="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow">
                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                Watch Machinery Demo
              </button>
            </div>
          </div>
        `;

        container.appendChild(card);
      });

      if (window.init3DTilt) window.init3DTilt();
    } catch (err) {
      console.error(err);
    }
  }

  // -------------------------------------------------------------
  // 4. Government Schemes & Kisan Loan Portals
  // -------------------------------------------------------------
  async function loadSchemes(category = 'all') {
    const container = document.getElementById('schemes-grid-container');
    if (!container) return;

    try {
      const url = category === 'all' ? '/api/schemes' : `/api/schemes?category=${category}`;
      const res = await fetch(url);
      const data = await res.json();
      const schemes = data.schemes || [];

      container.innerHTML = '';
      schemes.forEach((sch) => {
        const card = document.createElement('div');
        card.className = 'glass-card tilt-card rounded-2xl p-6 flex flex-col justify-between border border-emerald-500/15';

        card.innerHTML = `
          <div class="tilt-glare"></div>
          <div class="tilt-content flex-1 flex flex-col justify-between">
            <div>
              <div class="flex items-center justify-between mb-3">
                <span class="px-2.5 py-1 text-xs font-bold rounded-full badge-glow-amber">
                  ${sch.badge_label}
                </span>
                <span class="text-xs text-slate-400 uppercase tracking-wider">${sch.category.replace('_', ' ')}</span>
              </div>

              <h3 class="text-base font-bold text-white mb-1">${sch.title}</h3>
              <p class="text-xs text-emerald-400 font-medium mb-3">${sch.provider_name}</p>
              <p class="text-xs text-slate-300 leading-relaxed mb-4">${sch.description}</p>

              <div class="bg-black/30 border border-white/5 rounded-xl p-3.5 space-y-2 text-xs mb-4">
                <div>
                  <span class="text-slate-400 font-semibold block mb-0.5">Eligibility:</span>
                  <span class="text-slate-300 leading-relaxed">${sch.eligibility}</span>
                </div>
                <div class="pt-2 border-t border-white/5">
                  <span class="text-slate-400 font-semibold block mb-0.5">Financial Benefit:</span>
                  <span class="text-emerald-300 font-medium">${sch.benefits}</span>
                </div>
                ${
                  sch.interest_rate_subsidy
                    ? `
                  <div class="pt-2 border-t border-white/5">
                    <span class="text-slate-400 font-semibold block mb-0.5">Subsidy / Interest Rate:</span>
                    <span class="text-amber-300 font-bold">${sch.interest_rate_subsidy}</span>
                  </div>
                `
                    : ''
                }
              </div>
            </div>

            <div>
              <a href="${sch.application_url}" target="_blank" rel="noopener noreferrer" class="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-xl transition-all shadow flex items-center justify-center gap-1.5">
                Apply on Official Portal
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              </a>
            </div>
          </div>
        `;

        container.appendChild(card);
      });

      if (window.init3DTilt) window.init3DTilt();
    } catch (err) {
      console.error(err);
    }
  }

  // -------------------------------------------------------------
  // 5. Auth State & Modal Handling
  // -------------------------------------------------------------
  async function checkAuthState() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      const authBtn = document.getElementById('nav-auth-btn');

      if (data.authenticated && data.user) {
        if (authBtn) {
          authBtn.innerHTML = `
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-full bg-emerald-500 text-white font-bold text-xs flex items-center justify-center">
                ${data.user.name.charAt(0)}
              </div>
              <span class="text-xs font-semibold text-white max-w-[100px] truncate">${data.user.name}</span>
            </div>
          `;
          authBtn.onclick = () => {
            if (confirm('Log out from Kisan account?')) {
              fetch('/api/auth/logout', { method: 'POST' }).then(() => location.reload());
            }
          };
        }
      } else {
        if (authBtn) {
          authBtn.textContent = 'Farmer Sign In / Register';
          authBtn.onclick = () => window.openAuthModal();
        }
      }
    } catch (e) {
      console.error(e);
    }
  }

  window.openAuthModal = function () {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeAuthModal = function () {
    const modal = document.getElementById('auth-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    loadCrops('all');
    loadMachineryTools('all');
    loadSchemes('all');
    checkAuthState();

    // Seasonal Crop Tabs
    const seasonTabs = document.querySelectorAll('.season-tab-btn');
    seasonTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        seasonTabs.forEach((b) => {
          b.classList.remove('bg-emerald-600', 'text-white');
          b.classList.add('bg-white/5', 'text-slate-300');
        });
        btn.classList.add('bg-emerald-600', 'text-white');
        btn.classList.remove('bg-white/5', 'text-slate-300');
        loadCrops(btn.dataset.season);
      });
    });

    // Recommendation Trigger Button
    const runRecBtn = document.getElementById('btn-run-recommendation');
    if (runRecBtn) {
      runRecBtn.addEventListener('click', triggerSmartRecommendation);
    }

    // Machinery Category Tabs
    const toolTabs = document.querySelectorAll('.tool-tab-btn');
    toolTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        toolTabs.forEach((b) => {
          b.classList.remove('bg-emerald-600', 'text-white');
          b.classList.add('bg-white/5', 'text-slate-300');
        });
        btn.classList.add('bg-emerald-600', 'text-white');
        btn.classList.remove('bg-white/5', 'text-slate-300');
        loadMachineryTools(btn.dataset.category);
      });
    });

    // Schemes Category Tabs
    const schemeTabs = document.querySelectorAll('.scheme-tab-btn');
    schemeTabs.forEach((btn) => {
      btn.addEventListener('click', () => {
        schemeTabs.forEach((b) => {
          b.classList.remove('bg-emerald-600', 'text-white');
          b.classList.add('bg-white/5', 'text-slate-300');
        });
        btn.classList.add('bg-emerald-600', 'text-white');
        btn.classList.remove('bg-white/5', 'text-slate-300');
        loadSchemes(btn.dataset.category);
      });
    });

    // Auth Form Tabs (Login vs Register)
    const loginTab = document.getElementById('tab-auth-login');
    const registerTab = document.getElementById('tab-auth-register');
    const loginForm = document.getElementById('form-auth-login');
    const registerForm = document.getElementById('form-auth-register');

    if (loginTab && registerTab) {
      loginTab.addEventListener('click', () => {
        loginTab.classList.add('border-emerald-400', 'text-emerald-400');
        loginTab.classList.remove('border-transparent', 'text-slate-400');
        registerTab.classList.remove('border-emerald-400', 'text-emerald-400');
        registerTab.classList.add('border-transparent', 'text-slate-400');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      });

      registerTab.addEventListener('click', () => {
        registerTab.classList.add('border-emerald-400', 'text-emerald-400');
        registerTab.classList.remove('border-transparent', 'text-slate-400');
        loginTab.classList.remove('border-emerald-400', 'text-emerald-400');
        loginTab.classList.add('border-transparent', 'text-slate-400');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
      });
    }

    // Login Form Submit
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();

        try {
          const resp = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await resp.json();
          if (resp.ok) {
            window.closeAuthModal();
            if (window.showToast) window.showToast(`Welcome back, ${data.user.name}!`, 'success');
            checkAuthState();
          } else {
            alert(data.error || 'Login failed.');
          }
        } catch (err) {
          console.error(err);
        }
      });
    }

    // Register Form Submit
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
          name: document.getElementById('reg-name').value.trim(),
          email: document.getElementById('reg-email').value.trim(),
          password: document.getElementById('reg-password').value.trim(),
          role: document.getElementById('reg-role').value,
          state: document.getElementById('reg-state').value.trim(),
          district: document.getElementById('reg-district').value.trim(),
          farm_size_acres: document.getElementById('reg-acres').value,
          primary_crops: document.getElementById('reg-crops').value.trim(),
        };

        try {
          const resp = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await resp.json();
          if (resp.ok) {
            window.closeAuthModal();
            if (window.showToast) window.showToast(`Account created for ${data.user.name}!`, 'success');
            checkAuthState();
          } else {
            alert(data.error || 'Registration failed.');
          }
        } catch (err) {
          console.error(err);
        }
      });
    }
  });

  // Expose globally
  window.loadCrops = loadCrops;
  window.triggerSmartRecommendation = triggerSmartRecommendation;
})();
