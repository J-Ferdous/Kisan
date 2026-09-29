/**
 * Kisan Web Project - Farmer Community & Directory Module
 * Powers the farmer social feed, post creation with attachments, public verified farmer directory,
 * and farmer profile views & progress uploads.
 */

(function () {
  'use strict';

  let currentCategory = 'all';

  async function loadCommunityPosts(category = 'all') {
    currentCategory = category;
    const feedContainer = document.getElementById('community-feed-container');
    if (!feedContainer) return;

    feedContainer.innerHTML = `
      <div class="col-span-full flex flex-col items-center justify-center py-12 text-slate-400">
        <svg class="animate-spin h-8 w-8 text-emerald-400 mb-3" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading farmer field discussions...</span>
      </div>
    `;

    try {
      const url = category === 'all' ? '/api/community/posts' : `/api/community/posts?category=${category}`;
      const res = await fetch(url);
      const data = await res.json();
      const posts = data.posts || [];

      if (posts.length === 0) {
        feedContainer.innerHTML = `
          <div class="col-span-full text-center py-12 text-slate-400 glass-card rounded-2xl p-8">
            <p class="text-base">No discussions found in this category yet.</p>
            <p class="text-xs text-slate-500 mt-1">Be the first progressive farmer to post an update!</p>
          </div>
        `;
        return;
      }

      feedContainer.innerHTML = '';
      posts.forEach((post) => {
        const postCard = document.createElement('div');
        postCard.className = 'glass-card tilt-card rounded-2xl p-6 flex flex-col justify-between';

        const categoryBadgeColors = {
          growth_update: 'badge-glow-green',
          query: 'badge-glow-amber',
          harvest: 'badge-glow-cyan',
          machinery: 'badge-glow-green',
        };
        const badgeClass = categoryBadgeColors[post.category] || 'badge-glow-green';
        const categoryLabel = (post.category || 'update').replace('_', ' ');

        postCard.innerHTML = `
          <div class="tilt-glare"></div>
          <div class="tilt-content">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3 cursor-pointer" onclick="window.openFarmerProfile(${post.user_id || 1})">
                <div class="w-10 h-10 rounded-full bg-emerald-800/50 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-300">
                  ${post.author_name ? post.author_name.charAt(0) : 'F'}
                </div>
                <div>
                  <h4 class="text-sm font-semibold text-white hover:text-emerald-400 transition-colors">${post.author_name}</h4>
                  <p class="text-xs text-slate-400 flex items-center gap-1">
                    <svg class="w-3 h-3 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
                    ${post.author_location}
                  </p>
                </div>
              </div>
              <span class="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full ${badgeClass}">
                ${categoryLabel}
              </span>
            </div>

            <h3 class="text-base font-bold text-white mb-2">${post.title}</h3>
            <p class="text-xs text-slate-300 leading-relaxed mb-4">${post.content}</p>

            ${
              post.media_url
                ? `
              <div class="rounded-xl overflow-hidden mb-4 border border-white/10 max-h-60 bg-black/40">
                <img src="${post.media_url}" alt="Post attachment" class="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
              </div>
            `
                : ''
            }

            <div class="flex items-center justify-between pt-3 border-t border-white/10 text-xs text-slate-400">
              <div class="flex items-center gap-4">
                <button onclick="window.likeCommunityPost(${post.id}, this)" class="flex items-center gap-1.5 text-slate-300 hover:text-emerald-400 transition-colors group">
                  <svg class="w-4 h-4 group-hover:scale-125 transition-transform text-rose-400 fill-rose-400/20 group-hover:fill-rose-400" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                  <span class="like-count font-medium">${post.likes_count || 0}</span>
                </button>
                <span class="flex items-center gap-1">
                  <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                  ${post.comments_count || 0} replies
                </span>
              </div>
              <span>${post.created_at || 'Recently'}</span>
            </div>
          </div>
        `;
        feedContainer.appendChild(postCard);
      });

      if (window.init3DTilt) window.init3DTilt();
    } catch (err) {
      console.error('Error loading community posts:', err);
    }
  }

  window.likeCommunityPost = async function (postId, buttonEl) {
    try {
      const res = await fetch(`/api/community/posts/${postId}/like`, { method: 'POST' });
      const data = await res.json();
      const countEl = buttonEl.querySelector('.like-count');
      if (countEl) {
        countEl.textContent = data.likes_count;
        buttonEl.classList.add('text-emerald-400');
      }
    } catch (e) {
      console.error(e);
    }
  };

  async function loadFarmersDirectory(state = '', crop = '') {
    const directoryContainer = document.getElementById('farmers-directory-container');
    if (!directoryContainer) return;

    directoryContainer.innerHTML = `
      <div class="col-span-full text-center py-8 text-slate-400">
        <svg class="animate-spin h-6 w-6 text-emerald-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading verified agricultural producers...</span>
      </div>
    `;

    try {
      let url = '/api/auth/farmers';
      const params = [];
      if (state) params.push(`state=${encodeURIComponent(state)}`);
      if (crop) params.push(`crop=${encodeURIComponent(crop)}`);
      if (params.length) url += `?${params.join('&')}`;

      const res = await fetch(url);
      const data = await res.json();
      const farmers = data.farmers || [];

      directoryContainer.innerHTML = '';
      if (farmers.length === 0) {
        directoryContainer.innerHTML = `
          <div class="col-span-full text-center py-8 text-slate-400 glass-card rounded-xl p-6">
            No registered farmers found matching criteria.
          </div>
        `;
        return;
      }

      farmers.forEach((farmer) => {
        const card = document.createElement('div');
        card.className = 'glass-card tilt-card rounded-2xl p-5 flex flex-col justify-between border border-emerald-500/15 cursor-pointer hover:border-emerald-400/50 transition-all';
        card.setAttribute('onclick', `window.openFarmerProfile(${farmer.id})`);

        card.innerHTML = `
          <div class="tilt-glare"></div>
          <div class="tilt-content">
            <div class="flex items-center gap-3.5 mb-3">
              <div class="relative">
                <img src="${farmer.avatar_url}" alt="${farmer.name}" class="w-12 h-12 rounded-full border-2 border-emerald-500/40 bg-slate-900 object-cover" />
                ${
                  farmer.is_verified
                    ? `
                  <span class="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[10px]" title="Government / Kisan Verified">
                    ✓
                  </span>
                `
                    : ''
                }
              </div>
              <div>
                <h4 class="text-sm font-bold text-white flex items-center gap-1.5">
                  ${farmer.name}
                  ${farmer.is_verified ? '<span class="text-[10px] text-emerald-400 font-semibold px-1.5 py-0.5 bg-emerald-500/10 rounded">Verified</span>' : ''}
                </h4>
                <p class="text-xs text-slate-400">${farmer.district ? `${farmer.district}, ` : ''}${farmer.state || 'India'}</p>
              </div>
            </div>

            <div class="space-y-1.5 text-xs text-slate-300 my-3 bg-black/20 p-2.5 rounded-lg">
              <div class="flex justify-between">
                <span class="text-slate-400">Farm Holding:</span>
                <span class="font-semibold text-white">${farmer.farm_size_acres} Acres</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Primary Crops:</span>
                <span class="font-semibold text-emerald-300 text-right truncate max-w-[150px]">${farmer.primary_crops.join(', ') || 'Multi-crop'}</span>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2 border-t border-white/10">
              <button onclick="event.stopPropagation(); window.openFarmerProfile(${farmer.id});" class="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl transition-all shadow-md">
                View Profile & Field Updates
              </button>
            </div>
          </div>
        `;
        directoryContainer.appendChild(card);
      });

      if (window.init3DTilt) window.init3DTilt();
    } catch (err) {
      console.error('Error loading farmers:', err);
    }
  }

  // --- Farmer Profile Modal Logic ---
  window.openFarmerProfile = async function (farmerId) {
    const modal = document.getElementById('farmer-profile-modal');
    const postsContainer = document.getElementById('profile-posts-container');
    if (!modal || !postsContainer) return;

    postsContainer.innerHTML = `
      <div class="text-center py-8 text-slate-400">
        <svg class="animate-spin h-6 w-6 text-emerald-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Loading farmer profile & field progress logs...</span>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    try {
      const res = await fetch(`/api/community/farmers/${farmerId}/profile`);
      if (!res.ok) throw new Error('Profile not found');
      const data = await res.json();

      document.getElementById('profile-avatar').src = data.avatar_url;
      document.getElementById('profile-name').textContent = data.name;
      document.getElementById('profile-location-text').textContent = `${data.district ? data.district + ', ' : ''}${data.state || 'India'}`;
      document.getElementById('profile-crop-text').textContent = data.primary_crops && data.primary_crops.length ? data.primary_crops.join(', ') : 'Multi-Crop';
      document.getElementById('profile-bio-text').textContent = `"${data.bio || 'Progressive Kisan sharing field updates.'}"`;

      postsContainer.innerHTML = '';
      if (!data.posts || data.posts.length === 0) {
        postsContainer.innerHTML = `
          <div class="text-center py-8 text-slate-400 glass-card rounded-2xl p-6">
            <p class="text-sm font-semibold">No field progress updates posted yet.</p>
            <p class="text-xs text-slate-500 mt-1">This farmer hasn't uploaded field photos or videos.</p>
          </div>
        `;
        return;
      }

      data.posts.forEach((post) => {
        const postCard = document.createElement('div');
        postCard.className = 'glass-card rounded-2xl p-4 border border-white/10 space-y-3';

        postCard.innerHTML = `
          <div class="flex items-center justify-between text-[11px] text-slate-400">
            <span class="font-mono text-emerald-400">${post.created_at || 'Recent Update'}</span>
          </div>

          ${post.text ? `<p class="text-xs text-slate-200 leading-relaxed">${post.text}</p>` : ''}

          ${
            post.media_url
              ? post.media_type === 'video'
                ? `<video src="${post.media_url}" controls class="w-full max-h-64 rounded-xl object-cover border border-white/10 bg-black"></video>`
                : `<img src="${post.media_url}" alt="Field progress specimen" class="w-full max-h-64 rounded-xl object-cover border border-white/10 bg-black" />`
              : ''
          }
        `;
        postsContainer.appendChild(postCard);
      });

      if (window.lucide) window.lucide.createIcons();
    } catch (err) {
      postsContainer.innerHTML = `
        <div class="text-center py-6 text-red-400 text-xs">
          Unable to load farmer profile details.
        </div>
      `;
    }
  };

  window.closeFarmerProfileModal = function () {
    const modal = document.getElementById('farmer-profile-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  window.openUploadProgressModal = function () {
    const modal = document.getElementById('upload-progress-modal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  };

  window.closeUploadProgressModal = function () {
    const modal = document.getElementById('upload-progress-modal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadCommunityPosts('all');
    loadFarmersDirectory();

    // Category filter buttons
    const filterButtons = document.querySelectorAll('.community-filter-btn');
    filterButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        filterButtons.forEach((b) => {
          b.classList.remove('bg-emerald-600', 'text-white');
          b.classList.add('bg-white/5', 'text-slate-300');
        });
        btn.classList.add('bg-emerald-600', 'text-white');
        btn.classList.remove('bg-white/5', 'text-slate-300');
        loadCommunityPosts(btn.dataset.category);
      });
    });

    // Farmer directory search input
    const farmerSearchInput = document.getElementById('farmer-search-input');
    if (farmerSearchInput) {
      farmerSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        loadFarmersDirectory(query, query);
      });
    }

    // New Post Form
    const newPostForm = document.getElementById('new-post-form');
    if (newPostForm) {
      newPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(newPostForm);
        const submitBtn = newPostForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Publishing...';
        }

        try {
          const resp = await fetch('/api/community/posts', {
            method: 'POST',
            body: formData,
          });
          const resJson = await resp.json();

          if (resp.ok) {
            newPostForm.reset();
            const modal = document.getElementById('new-post-modal');
            if (modal) {
              modal.classList.add('hidden');
              modal.classList.remove('flex');
            }
            if (window.showToast) window.showToast('Your update has been shared with the Kisan community!', 'success');
            loadCommunityPosts(currentCategory);
          } else {
            alert(resJson.error || 'Failed to publish post.');
          }
        } catch (err) {
          console.error(err);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Update';
          }
        }
      });
    }

    // Upload Field Progress Form
    const uploadProgressForm = document.getElementById('upload-progress-form');
    if (uploadProgressForm) {
      uploadProgressForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const textInput = document.getElementById('progress-text-input').value;
        const mediaInput = document.getElementById('progress-media-input').files[0];
        const submitBtn = document.getElementById('btn-submit-progress');

        const formData = new FormData();
        formData.append('text_content', textInput);
        if (mediaInput) {
          formData.append('media_file', mediaInput);
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>Uploading...</span>`;
        }

        try {
          const res = await fetch('/api/community/farmers/posts/create', {
            method: 'POST',
            body: formData,
          });
          const data = await res.json();

          if (res.ok) {
            alert('Field progress update published successfully!');
            window.closeUploadProgressModal();
            uploadProgressForm.reset();
          } else {
            alert(data.error || 'Failed to upload field update.');
          }
        } catch (err) {
          alert('Server connection error. Please try again.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i><span>Publish Field Progress</span>`;
            if (window.lucide) window.lucide.createIcons();
          }
        }
      });
    }
  });

  // Expose globally
  window.loadCommunityPosts = loadCommunityPosts;
  window.loadFarmersDirectory = loadFarmersDirectory;
})();