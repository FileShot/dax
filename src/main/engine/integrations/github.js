// ─── GitHub Integration ─────────────────────────────────────
// Uses GitHub REST API with Personal Access Token
// Supports: issues, PRs, repos, commits

const https = require('https');

function githubApi(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Dax-Agent/1.0',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (data) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers,
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          const result = chunks ? JSON.parse(chunks) : {};
          if (res.statusCode >= 400) reject(new Error(result.message || `GitHub API ${res.statusCode}`));
          else resolve(result);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

module.exports = {
  id: 'github',
  name: 'GitHub',
  category: 'development',
  icon: 'Github',
  description: 'Manage repos, issues, pull requests, and commits',
  configFields: [
    { key: 'token', label: 'Personal Access Token', type: 'password', required: true },
    { key: 'default_owner', label: 'Default Owner/Org', type: 'text', placeholder: 'username' },
    { key: 'default_repo', label: 'Default Repository', type: 'text', placeholder: 'my-repo' },
  ],

  credentials: null,
  connected: false,

  async connect(creds) {
    await githubApi('GET', '/user', creds.token);
    this.credentials = creds;
    this.connected = true;
  },

  async disconnect() {
    this.connected = false;
    this.credentials = null;
  },

  async test(creds) {
    try {
      const user = await githubApi('GET', '/user', creds.token);
      return { success: true, message: `Authenticated as ${user.login}` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  actions: {
    list_repos: async (params, creds) => {
      const result = await githubApi('GET', `/user/repos?per_page=${params.limit || 30}&sort=updated`, creds.token);
      return result.map((r) => ({ name: r.full_name, description: r.description, stars: r.stargazers_count, language: r.language, url: r.html_url }));
    },

    create_issue: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      if (!owner || !repo) throw new Error('Owner and repo required');
      const result = await githubApi('POST', `/repos/${owner}/${repo}/issues`, creds.token, {
        title: params.title, body: params.body, labels: params.labels,
      });
      return { number: result.number, url: result.html_url, title: result.title };
    },

    list_issues: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      const state = params.state || 'open';
      const result = await githubApi('GET', `/repos/${owner}/${repo}/issues?state=${state}&per_page=30`, creds.token);
      return result.map((i) => ({ number: i.number, title: i.title, state: i.state, labels: i.labels?.map(l => l.name), url: i.html_url }));
    },

    get_issue: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      const result = await githubApi('GET', `/repos/${owner}/${repo}/issues/${params.number}`, creds.token);
      return { number: result.number, title: result.title, body: result.body, state: result.state, url: result.html_url };
    },

    add_comment: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      const result = await githubApi('POST', `/repos/${owner}/${repo}/issues/${params.number}/comments`, creds.token, { body: params.body });
      return { id: result.id, url: result.html_url };
    },

    list_pulls: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      const result = await githubApi('GET', `/repos/${owner}/${repo}/pulls?state=${params.state || 'open'}`, creds.token);
      return result.map((p) => ({ number: p.number, title: p.title, state: p.state, user: p.user?.login, url: p.html_url }));
    },

    get_file: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      const ref = params.branch ? `?ref=${params.branch}` : '';
      const result = await githubApi('GET', `/repos/${owner}/${repo}/contents/${params.path}${ref}`, creds.token);
      if (result.content) {
        return { path: result.path, content: Buffer.from(result.content, 'base64').toString('utf-8'), sha: result.sha };
      }
      return result;
    },

    update_issue: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      if (!params.number) throw new Error('Issue number required');
      const body = {};
      if (params.title !== undefined) body.title = params.title;
      if (params.body !== undefined) body.body = params.body;
      if (params.state !== undefined) body.state = params.state;
      if (params.labels !== undefined) body.labels = params.labels;
      if (params.assignees !== undefined) body.assignees = params.assignees;
      const result = await githubApi('PATCH', `/repos/${owner}/${repo}/issues/${params.number}`, creds.token, body);
      return { number: result.number, title: result.title, state: result.state, url: result.html_url };
    },

    close_issue: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      if (!params.number) throw new Error('Issue number required');
      const result = await githubApi('PATCH', `/repos/${owner}/${repo}/issues/${params.number}`, creds.token, {
        state: 'closed', state_reason: params.reason || 'completed',
      });
      return { number: result.number, state: result.state, url: result.html_url };
    },

    create_pull: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      if (!params.title || !params.head || !params.base) throw new Error('title, head, and base required');
      const result = await githubApi('POST', `/repos/${owner}/${repo}/pulls`, creds.token, {
        title: params.title, body: params.body || '', head: params.head, base: params.base, draft: params.draft || false,
      });
      return { number: result.number, title: result.title, url: result.html_url, state: result.state };
    },

    merge_pull: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      if (!params.number) throw new Error('Pull request number required');
      const result = await githubApi('PUT', `/repos/${owner}/${repo}/pulls/${params.number}/merge`, creds.token, {
        commit_title: params.commit_title, merge_method: params.method || 'merge',
      });
      return { merged: result.merged, sha: result.sha, message: result.message };
    },

    list_commits: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      const branch = params.branch ? `&sha=${params.branch}` : '';
      const result = await githubApi('GET', `/repos/${owner}/${repo}/commits?per_page=${params.limit || 20}${branch}`, creds.token);
      return result.map((c) => ({
        sha: c.sha?.slice(0, 7), message: c.commit?.message, author: c.commit?.author?.name, date: c.commit?.author?.date, url: c.html_url,
      }));
    },

    list_branches: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      const result = await githubApi('GET', `/repos/${owner}/${repo}/branches?per_page=${params.limit || 30}`, creds.token);
      return result.map((b) => ({ name: b.name, sha: b.commit?.sha?.slice(0, 7), protected: b.protected }));
    },

    create_branch: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      if (!params.name || !params.from_sha) throw new Error('Branch name and from_sha required');
      const result = await githubApi('POST', `/repos/${owner}/${repo}/git/refs`, creds.token, {
        ref: `refs/heads/${params.name}`, sha: params.from_sha,
      });
      return { ref: result.ref, sha: result.object?.sha };
    },

    search_repos: async (params, creds) => {
      if (!params.query) throw new Error('query required');
      const sort = params.sort ? `&sort=${params.sort}` : '';
      const result = await githubApi('GET', `/search/repositories?q=${encodeURIComponent(params.query)}&per_page=${params.limit || 10}${sort}`, creds.token);
      return (result.items || []).map((r) => ({ name: r.full_name, description: r.description, stars: r.stargazers_count, language: r.language, url: r.html_url }));
    },

    create_release: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      if (!params.tag) throw new Error('tag required');
      const result = await githubApi('POST', `/repos/${owner}/${repo}/releases`, creds.token, {
        tag_name: params.tag, name: params.name || params.tag, body: params.body || '',
        draft: params.draft || false, prerelease: params.prerelease || false,
      });
      return { id: result.id, tag: result.tag_name, name: result.name, url: result.html_url };
    },

    list_contributors: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      const result = await githubApi('GET', `/repos/${owner}/${repo}/contributors?per_page=${params.limit || 30}`, creds.token);
      return result.map((c) => ({ login: c.login, contributions: c.contributions, url: c.html_url }));
    },

    create_webhook: async (params, creds) => {
      const owner = params.owner || creds.default_owner;
      const repo = params.repo || creds.default_repo;
      if (!params.url) throw new Error('Webhook URL required');
      const result = await githubApi('POST', `/repos/${owner}/${repo}/hooks`, creds.token, {
        name: 'web', active: true,
        config: { url: params.url, content_type: 'json', secret: params.secret || '' },
        events: params.events || ['push', 'pull_request'],
      });
      return { id: result.id, url: result.config?.url, events: result.events, active: result.active };
    },
  },

  async executeAction(actionName, params) {
    const action = this.actions[actionName];
    if (!action) throw new Error(`Unknown action: ${actionName}`);
    return action(params, this.credentials);
  },
};
