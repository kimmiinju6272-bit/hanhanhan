(function () {
  const nav = document.getElementById("nav");
  const main = document.getElementById("main");
  const aside = document.getElementById("aside");
  const form = document.getElementById("search-form");
  const input = document.getElementById("q");
  const clearBtn = document.getElementById("search-clear");
  const home = document.getElementById("home-link");
  const live = document.getElementById("live");

  const state = { category: "all", query: "", postId: null };
  let lastFocusedPost = null;
  let booted = false;

  function esc(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function norm(value) {
    return String(value).toLowerCase().replace(/\s+/g, "");
  }

  function categoryOf(id) {
    return BOARD.categories.find((item) => item.id === id) || BOARD.categories[0];
  }

  function postById(id) {
    return BOARD.posts.find((item) => item.id === id) || null;
  }

  function haystack(post) {
    const category = categoryOf(post.category);
    return norm([
      post.title,
      post.excerpt,
      post.when,
      post.modern,
      post.author,
      post.status,
      post.policy,
      post.role,
      category.name,
      ...(post.tags || []),
      ...post.body,
      ...((post.perspectives || []).flatMap((item) => [item.heading, item.body])),
      ...post.sources.flatMap((item) => [item.title, item.body]),
      ...post.comments.flatMap((item) => [item.name, item.role, item.text])
    ].join(" "));
  }

  function filteredPosts() {
    const query = norm(state.query.trim());
    return BOARD.posts
      .filter((post) => state.category === "all" || post.category === state.category)
      .filter((post) => !query || haystack(post).includes(query))
      .sort((a, b) => a.order - b.order);
  }

  function parseHash() {
    const hash = location.hash.replace(/^#/, "");
    const categoryMatch = hash.match(/c\/([a-z0-9-]+)/);
    const postMatch = hash.match(/p\/([a-z0-9-]+)/);
    const categoryId = categoryMatch ? categoryMatch[1] : "all";
    const known = BOARD.categories.some((item) => item.id === categoryId);
    return {
      category: known ? categoryId : "all",
      postId: postMatch ? postMatch[1] : null,
      known: !categoryMatch || known
    };
  }

  function postHref(post) {
    const category = state.category === "all" || state.category === post.category
      ? state.category
      : post.category;
    return `#c/${category}/p/${post.id}`;
  }

  function initialOf(name) {
    const compact = name.replace(/\s/g, "");
    return esc(compact.slice(0, 1));
  }

  function renderNav() {
    const items = BOARD.categories.map((category) => {
      const count = category.id === "all"
        ? BOARD.posts.length
        : BOARD.posts.filter((post) => post.category === category.id).length;
      const current = category.id === state.category ? ' aria-current="page"' : "";
      return `<li><a class="cat-link" href="#c/${category.id}"${current}>${esc(category.name)}<small>${count}</small></a></li>`;
    }).join("");
    nav.innerHTML = `<div class="side-card"><h2 class="side-title">게시판</h2><ul class="cat-list">${items}</ul></div>`;
  }

  function renderList() {
    const posts = filteredPosts();
    const category = categoryOf(state.category);
    const query = state.query.trim();
    const heading = query ? "검색 결과" : category.name;
    const blurb = query
      ? `‘${esc(query)}’ · ${esc(category.name)}`
      : (category.id === "all" ? "" : esc(category.blurb));
    live.textContent = query ? `${posts.length}건의 글` : "";

    const list = posts.length
      ? `<div class="post-list">${posts.map(renderPostItem).join("")}</div>`
      : `<p class="empty">해당하는 글이 없습니다. 다른 말이나 게시판을 골라 보세요.</p>`;

    main.innerHTML = `
      <section class="panel">
        <header class="list-head">
          <div>
            <h2>${esc(heading)}</h2>
            ${blurb ? `<p class="blurb">${blurb}</p>` : ""}
          </div>
          <p class="count">${posts.length}건</p>
        </header>
        ${list}
      </section>
      ${rankingHtml()}`;
  }

  function commentRanking() {
    const counts = new Map();
    BOARD.posts.forEach((post) => {
      post.comments.forEach((item) => {
        counts.set(item.name, (counts.get(item.name) || 0) + 1);
      });
    });
    let rank = 0;
    let previous = null;
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))
      .map(([name, count], index) => {
        if (count !== previous) {
          rank = index + 1;
          previous = count;
        }
        return { rank, name, count };
      });
  }

  function rankingHtml() {
    const groups = [];
    commentRanking().forEach((item) => {
      const last = groups[groups.length - 1];
      if (!last || last.count !== item.count) {
        groups.push({ rank: item.rank, count: item.count, names: [item.name] });
      } else {
        last.names.push(item.name);
      }
    });
    const rows = groups.slice(0, 3);
    if (!rows.length) return "";
    return `
      <section class="panel rank-card">
        <header class="list-head">
          <h2>활동왕 랭킹</h2>
        </header>
        <ol class="rank-list">
          ${rows.map((item) => {
            const others = item.names.length - 1;
            const label = others > 0 ? `${item.names[0]} 외 ${others}인` : item.names[0];
            return `
            <li>
              <span class="rank-no">${item.rank}</span>
              <span class="rank-name">${esc(label)}</span>
              <span class="rank-count">댓글 ${item.count}</span>
            </li>`;
          }).join("")}
        </ol>
      </section>`;
  }

  function commentsHtml(post) {
    return post.comments.map((item, index) => `
      <article class="comment">
        <div class="avatar" aria-hidden="true">${initialOf(item.name)}</div>
        <div>
          <h3>${esc(item.name)}</h3>
          <div class="comment-role">댓글 ${index + 1}${item.replyTo ? ` → ${esc(item.replyTo)}` : ""}</div>
          <p>${esc(item.text)}</p>
        </div>
      </article>`).join("");
  }

  function folds(post, suffix, commentsOpen) {
    const cmId = `cm-${post.id}${suffix}`;
    const open = Boolean(commentsOpen);
    return `
      <div class="post-actions">
        <button type="button" class="fold-btn" data-fold="comments" aria-expanded="${open}" aria-controls="${cmId}">${open ? "댓글 접기" : "댓글 펼치기"}</button>
      </div>
      <div class="fold comments" id="${cmId}" ${open ? "" : "hidden"}>${commentsHtml(post)}</div>`;
  }

  function authorLabel(post) {
    return post.author ? `${post.status}${post.authorSep || " · "}${post.author}` : post.status;
  }

  function renderPostItem(post) {
    return `
      <a class="post-item" href="${postHref(post)}">
        <h3 class="post-title">${esc(post.title)}</h3>
        <span class="post-author">${esc(authorLabel(post))}</span>
      </a>`;
  }

  function renderPost(post) {
    const category = categoryOf(post.category);
    document.title = `${post.title} — 漢나라 민심광장`;
    const lenses = (post.perspectives || []).map((item) => `
      <article class="lens ${esc(item.tone)}">
        <h3>${esc(item.heading)}</h3>
        <p>${esc(item.body)}</p>
      </article>`).join("");
    main.innerHTML = `
      <article class="panel detail-card">
        <header class="article-head">
          <a class="back" href="#c/${esc(state.category)}">목록으로</a>
          <p class="status"><span class="field-label">작성자 신분</span>${esc(post.status)}${post.author ? esc(post.authorSep || " · ") + esc(post.author) : ""}</p>
          <h2 class="detail-title post-title" tabindex="-1">${esc(post.title)}</h2>
        </header>
        <div class="post-body detail-body">${post.body.map((paragraph) => `<p>${esc(paragraph)}</p>`).join("")}</div>
        <p class="policy detail-policy"><span class="field-label">분류</span>${esc(category.name)} · ${esc(post.policy)}</p>
        <div class="meta detail-meta">
          <span>추천 ${post.recommends.toLocaleString("ko-KR")}</span>
          <span>댓글 ${post.comments.length}</span>
        </div>
        ${lenses ? `<section class="section" id="lenses"><h2>자세한 시선</h2><div class="lenses">${lenses}</div></section>` : ""}
        <div class="detail-folds">${folds(post, "-detail", true)}</div>
      </article>`;

    if (lastFocusedPost !== post.id) {
      const title = main.querySelector(".detail-title");
      if (title) title.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    lastFocusedPost = post.id;
  }

  function renderMissing() {
    document.title = "글을 찾을 수 없습니다 — 漢나라 민심광장";
    main.innerHTML = `
      <section class="panel missing">
        <h2>글을 찾을 수 없습니다</h2>
        <p class="blurb">주소에 적힌 글이 이 광장에는 없습니다.</p>
        <p><a class="text-link" href="#c/${esc(state.category)}">목록으로 돌아가기</a></p>
      </section>`;
  }

  function renderMain() {
    if (!state.postId) {
      document.title = "漢나라 민심광장";
      lastFocusedPost = null;
      renderList();
      return;
    }
    const post = postById(state.postId);
    if (!post) {
      renderMissing();
      return;
    }
    renderPost(post);
  }

  function renderAside() {
    const popular = [...BOARD.posts]
      .sort((a, b) => b.recommends - a.recommends)
      .slice(0, BOARD.popularCount);
    const references = BOARD.references.map((item) => `<li>${esc(item)}</li>`).join("");

    aside.innerHTML = `
      <div class="aside-stack">
        <section class="side-card">
          <h2 class="side-title">인기 게시글</h2>
          <ul class="popular-list">
            ${popular.map((post) => `<li><a href="${postHref(post)}"><strong>${esc(post.title)}</strong><span class="meta"><span>추천 ${post.recommends.toLocaleString("ko-KR")}</span><span>댓글 ${post.comments.length}</span></span></a></li>`).join("")}
          </ul>
        </section>
        <section class="side-card">
          <h2 class="side-title">참고문헌</h2>
          <ol class="ref-list">${references}</ol>
        </section>
      </div>`;
  }

  function render() {
    renderNav();
    renderMain();
    renderAside();
  }

  function syncFromHash() {
    const route = parseHash();
    state.category = route.category;
    state.postId = route.postId;
    if (!route.known) {
      history.replaceState(null, "", route.postId ? `#c/all/p/${route.postId}` : "#c/all");
    }
    render();
    if (booted && !state.postId) window.scrollTo({ top: 0, behavior: "smooth" });
    booted = true;
  }

  form.addEventListener("submit", (event) => event.preventDefault());

  input.addEventListener("input", () => {
    state.query = input.value;
    clearBtn.hidden = !state.query;
    if (state.postId) {
      state.postId = null;
      history.replaceState(null, "", `#c/${state.category}`);
    }
    renderMain();
    renderAside();
  });

  clearBtn.addEventListener("click", () => {
    input.value = "";
    state.query = "";
    clearBtn.hidden = true;
    input.focus();
    renderMain();
  });

  home.addEventListener("click", () => {
    input.value = "";
    state.query = "";
    clearBtn.hidden = true;
    if (location.hash === "#c/all" || location.hash === "#c/all/") {
      state.category = "all";
      state.postId = null;
      render();
    }
  });

  main.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fold]");
    if (!button) return;
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    const open = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!open));
    panel.hidden = open;
    button.textContent = open ? "댓글 펼치기" : "댓글 접기";
  });

  window.addEventListener("hashchange", syncFromHash);

  if (!location.hash) history.replaceState(null, "", "#c/all");
  syncFromHash();
})();
