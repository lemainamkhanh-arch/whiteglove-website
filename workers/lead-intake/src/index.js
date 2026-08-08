const NOTION_VERSION = '2022-06-28'

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}
function jsonResponse(obj, status, origin) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}
function mapService(service) {
  const s = (service || '').toString().trim()
  if (s.includes('nhập khẩu')) return 'Import-Export'
  if (s.includes('Mua hộ')) return 'Mua hộ hàng giá trị cao'
  return 'Delivery'
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOWED_ORIGIN || 'https://whiteglove.vn'
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) })
    if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405, origin)
    if (!env.NOTION_API_KEY || !env.NOTION_LEAD_DATABASE_ID) {
      return jsonResponse({ error: 'Server chưa được cấu hình' }, 500, origin)
    }
    let body
    try { body = await request.json() } catch (e) { return jsonResponse({ error: 'Invalid JSON body' }, 400, origin) }

    const name = (body.name || '').toString().trim()
    const email = (body.email || '').toString().trim()
    const phone = (body.phone || '').toString().trim()
    if (!name || !email || !phone) return jsonResponse({ error: 'Thiếu họ tên, email hoặc số điện thoại.' }, 400, origin)

    const company = (body.company || '').toString().trim()
    const details = (body.details || '').toString().trim()
    const date = (body.date || '').toString().trim()
    const service = mapService(body.service)

    const properties = {
      'Họ tên': { title: [{ text: { content: name.slice(0, 2000) } }] },
      'Email': { email },
      'Số điện thoại': { phone_number: phone },
      'Loại job': { select: { name: service } },
      'Nguồn': { select: { name: 'Website Form' } },
    }
    if (company) properties['Công ty'] = { rich_text: [{ text: { content: company.slice(0, 2000) } }] }
    if (details) properties['Mô tả hàng hóa'] = { rich_text: [{ text: { content: details.slice(0, 2000) } }] }
    if (date) properties['Ngày mong muốn'] = { date: { start: date } }

    const notionRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.NOTION_API_KEY}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parent: { database_id: env.NOTION_LEAD_DATABASE_ID }, properties }),
    })
    if (!notionRes.ok) {
      console.log('Notion API error: ' + (await notionRes.text()))
      return jsonResponse({ error: 'Không thể lưu lead vào Notion.' }, 502, origin)
    }
    return jsonResponse({ ok: true }, 200, origin)
  },
}
