import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const { credential_id } = await req.json().catch(() => ({}))

    if (!credential_id) {
      return new Response(JSON.stringify({ message: '缺少 credential_id' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // 查询是否已有该凭证对应的用户
    const { data: existingMap } = await supabaseAdmin
      .from('anon_credential_map')
      .select('auth_uid')
      .eq('credential_id', credential_id)
      .maybeSingle()

    let authUid: string

    if (existingMap?.auth_uid) {
      // 已有映射，直接使用
      authUid = existingMap.auth_uid
    } else {
      // 新匿名用户：创建账号
      const email = `anon_${credential_id}@miaoda.com`
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { is_anonymous: true },
      })

      if (createError) {
        return new Response(JSON.stringify({ message: createError.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        })
      }

      authUid = createData.user.id

      // 存储映射关系
      await supabaseAdmin.from('anon_credential_map').insert({
        credential_id,
        auth_uid: authUid,
      })
    }

    // 获取用户邮箱以生成 magic link
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(authUid)
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ message: '获取用户信息失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    // 生成 magic link
    const { data: magicLinkData, error: magicLinkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email,
    })

    if (magicLinkError || !magicLinkData?.properties?.hashed_token) {
      return new Response(JSON.stringify({ message: '生成登录令牌失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    return new Response(
      JSON.stringify({ hashed_token: magicLinkData.properties.hashed_token }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  }
})
