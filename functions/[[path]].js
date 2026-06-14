import testData from './path_train.json';

const DEFAULT_DATABASE = 'https://jctqmbsxufpqylqbouwg.supabase.co/storage/v1/object/public/gbucket/';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function getSingleGroupConfig() {
  const group = testData.single_group || testData.default_group || testData;
  const database = group.database || testData.database || DEFAULT_DATABASE;

  const pre_fake = asArray(group.pre_fake || group.preFake || group.pre?.fake);
  const pre_real = asArray(group.pre_real || group.preReal || group.pre?.real);
  const post_fake = asArray(group.post_fake || group.formal_fake || group.final_fake || group.postFake || group.post?.fake);
  const post_real = asArray(group.post_real || group.formal_real || group.final_real || group.postReal || group.post?.real);

  if (!pre_fake.length || !pre_real.length || !post_fake.length || !post_real.length) {
    throw new Error('path_train.json must define single_group.pre_fake/pre_real/post_fake/post_real');
  }

  return {
    name: group.name || 'single_group',
    database,
    pre_fake,
    pre_real,
    post_fake,
    post_real,
    train_examples: asArray(group.train_examples),
    train_text: asArray(group.train_text),
    video_url: group.video_url || `${database}training_video/Mix.mp4`,
  };
}

//后端的请求实现：
export const onRequest = async (ctx) => {
  const { request, env, next } = ctx;
  const url = new URL(request.url);

  // 辅助函数：返回JSON响应
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  // 辅助函数：返回错误响应
  const bad = (msg, status = 400) => json({ error: msg }, status);

  // 处理跨域预检请求
  if (request.method === 'OPTIONS') {
    return json({}, 204);
  }

  // 握手接口：生成用户ID
  if (request.method === 'POST' && url.pathname === '/handshake') {
    try {
      const uid = crypto.randomUUID();
      await upsertColumnJson(env, uid, 'info', { id: 'user registering' });
      return json({ uid });
    } catch (error) {
      return bad('Error: ' + error.message, 500);
    }
  }

  // 单组版本不再使用 Allocator；保留该接口仅用于确认运行状态。
  if (url.pathname === '/debug/alloc') {
    return json({ allocator_disabled: true, hasBinding: !!env.ALLOCATOR });
  }

  // 获取confidence结果
  if (request.method === 'POST' && url.pathname === '/confidence') {
    try {
      const body = await request.json().catch(() => ({}));
      const { uid, stage, questionnaire } = body || {};
      if (!uid) return bad('uid is required');

      if (stage === 'pre') {
        await upsertColumnJson(env, uid, 'pre_confidence', { questionnaire });
      } else if (stage === 'formal') {
        await upsertColumnJson(env, uid, 'final_confidence', { questionnaire });
      } else if (stage === 'train') {
        await upsertColumnJson(env, uid, 'train_confidence', { questionnaire });
      }
      return json({ res: 'ok' });
    } catch (error) {
      return bad('Error: ' + error.message, 500);
    }
  }

  // 获取feedback结果
  if (request.method === 'POST' && url.pathname === '/feedback') {
    try {
      const body = await request.json().catch(() => ({}));
      const { uid, feedback } = body || {};
      if (!uid) return bad('uid is required');

      await upsertColumnJson(env, uid, 'feedback', { feedback });
      return json({ res: 'ok' });
    } catch (error) {
      return bad('Error: ' + error.message, 500);
    }
  }

  // 分配测试内容接口：单组、单图-only，不再调用 ALLOCATOR。
  if (request.method === 'POST' && url.pathname === '/assign') {
    try {
      const body = await request.json().catch(() => ({}));
      const { uid, questionnaire } = body || {};
      if (!uid) return bad('uid is required');

      const cfg = getSingleGroupConfig();
      await upsertColumnJson(env, uid, 'info', {
        questionnaire,
        time: new Date().toISOString(),
        group: 0,
        dataset: cfg.name,
      });

      return json({
        group: 0,
        dataset: cfg.name,
        database: cfg.database,

        // 新前端优先读取这些显式字段。
        pre_fake: cfg.pre_fake,
        pre_real: cfg.pre_real,
        post_fake: cfg.post_fake,
        post_real: cfg.post_real,

        // 兼容旧前端：前半段为 post/formal，后半段为 pre。
        fake_split: [...cfg.post_fake, ...cfg.pre_fake],
        real_split: [...cfg.post_real, ...cfg.pre_real],

        train_examples: cfg.train_examples,
        train_text: cfg.train_text,
        video_url: cfg.video_url,
        single_first: 1,
      });
    } catch (error) {
      return bad('Failed to assign test content: ' + error.message, 500);
    }
  }

  // 提交测试结果接口
  if (request.method === 'POST' && url.pathname === '/submit') {
    try {
      const body = await request.json().catch(() => ({}));
      const { uid, group, policy, stage, single, attention, timestamp } = body || {};
      if (!uid) return bad('uid is required');

      if (stage === 'pre') {
        await upsertColumnJson(env, uid, 'pre_single', { group, policy, pre_single: single });
      } else if (stage === 'formal') {
        await upsertColumnJson(env, uid, 'final_single', { group, policy, final_single: single });
      } else if (stage === 'train') {
        await upsertColumnJson(env, uid, 'train_single', { train_single: single });
      }

      await upsertColumnJson(env, uid, 'attention', { attention });
      if (timestamp) {
        await upsertColumnJson(env, uid, 'timestamp', {
          ...timestamp,
          last_stage: stage || null,
          server_received_at: new Date().toISOString()
        });
      }
      return json({ ok: true });
    } catch (error) {
      return bad('Failed to submit results: ' + error.message, 500);
    }
  }

  // 提交分数接口：单图-only，保留旧字段名以兼容现有 score JSON。
  if (request.method === 'POST' && url.pathname === '/submitscore') {
    try {
      const body = await request.json().catch(() => ({}));
      const { uid, score1, score2, score3, score4 } = body || {};
      if (!uid) return bad('uid is required');

      const row = {
        score_ps: score1 ?? null,
        score_pd: score2 ?? null,
        score_fs: score3 ?? null,
        score_fd: score4 ?? null,
      };
      await upsertColumnJson(env, uid, 'score', row);
      return json({ ok: true });
    } catch (error) {
      return bad('Failed to submit results: ' + error.message, 500);
    }
  }

  // 其他请求交给静态文件处理
  return next();
};

// 把一个 JSON 写入 gtable 的某一列：按 id upsert
// inputs: userId: string|number, name: string(列名), value: any(JSON)
async function upsertColumnJson(env, userId, name, value) {
  if (!userId) throw new Error('userId is required');
  if (!name) throw new Error('name (column) is required');

  const url = `${env.SUPABASE_URL}/rest/v1/gtable_eyetracker?on_conflict=id&select=id`;
  const body = { id: userId };
  body[name] = value;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': env.SUPABASE_SERVICE_ROLE,
      'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE}`,
      'Prefer': 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Supabase upsert failed: ${res.status} ${res.statusText} ${text}`);
  }
  return await res.json();
}
