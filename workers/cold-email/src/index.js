const NOTION_VERSION = "2022-06-28"
const STOP_STATUSES = ["Đã phản hồi", "Đã đặt hẹn", "Không quan tâm", "Dừng (opt-out)"]
const FOLLOWUP_DAYS = 3
const MAX_STEPS = 3
const ACTIVE_CAMPAIGN_STATUS = "Đang chạy"

async function notionFetch(env, path, options) {
  options = options || {}
  var url = "https://api.notion.com/v1" + path
  var headers = Object.assign({
    "Authorization": "Bearer " + env.NOTION_API_KEY,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json"
  }, options.headers || {})
  var res = await fetch(url, Object.assign({}, options, { headers: headers }))
  var data = await res.json()
  if (!res.ok) {
    throw new Error("Notion API error " + res.status + ": " + JSON.stringify(data))
  }
  return data
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysISO(dateStr, days) {
  var d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function getTitle(prop) {
  var arr = (prop && prop.title) || []
  return arr.map(function (t) { return t.plain_text }).join("")
}
function getText(prop) {
  var arr = (prop && prop.rich_text) || []
  return arr.map(function (t) { return t.plain_text }).join("")
}
function getSelect(prop) {
  return (prop && prop.select && prop.select.name) || ""
}
function getStatus(prop) {
  return (prop && prop.status && prop.status.name) || ""
}
function getNumber(prop) {
  return (prop && typeof prop.number === "number") ? prop.number : 0
}
function getEmail(prop) {
  return (prop && prop.email) || ""
}

function fillTemplate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, function (m, key) {
    return vars[key] !== undefined ? vars[key] : m
  })
}

async function getCampaign(env, campaignId) {
  return await notionFetch(env, "/pages/" + campaignId)
}

async function queryActiveCampaigns(env) {
  var filter = { property: "Trạng thái", status: { equals: ACTIVE_CAMPAIGN_STATUS } }
  var data = await notionFetch(env, "/databases/" + env.NOTION_CAMPAIGNS_DB_ID + "/query", {
    method: "POST",
    body: JSON.stringify({ filter: filter, page_size: 50 })
  })
  return data.results
}

async function queryDueProspectsForCampaign(env, campaignId) {
  var today = todayISO()
  var filter = { and: [] }
  STOP_STATUSES.forEach(function (s) {
    filter.and.push({ property: "Trạng thái", status: { does_not_equal: s } })
  })
  filter.and.push({ property: "Ngày gửi tiếp theo", date: { on_or_before: today } })
  filter.and.push({ property: "Chiến dịch", relation: { contains: campaignId } })
  var data = await notionFetch(env, "/databases/" + env.NOTION_PROSPECTS_DB_ID + "/query", {
    method: "POST",
    body: JSON.stringify({ filter: filter, page_size: 100 })
  })
  return data.results
}

async function findTemplate(env, step, nganh) {
  var filter = {
    and: [
      { property: "Bước", number: { equals: step } },
      { property: "Đang sử dụng", checkbox: { equals: true } }
    ]
  }
  var data = await notionFetch(env, "/databases/" + env.NOTION_TEMPLATES_DB_ID + "/query", {
    method: "POST",
    body: JSON.stringify({ filter: filter, page_size: 20 })
  })
  var results = data.results
  if (results.length === 0) return null
  var matched = results.find(function (r) {
    var options = (r.properties["Ngành áp dụng"] && r.properties["Ngành áp dụng"].multi_select) || []
    return options.some(function (o) { return o.name === nganh })
  })
  return matched || results[0]
}

async function getPageBodyText(env, pageId) {
  var data = await notionFetch(env, "/blocks/" + pageId + "/children?page_size=100")
  var lines = []
  data.results.forEach(function (block) {
    var type = block.type
    if (type === "callout") return
    var rich = block[type] && block[type].rich_text
    lines.push(rich ? rich.map(function (t) { return t.plain_text }).join("") : "")
  })
  return lines.join("\n")
}

async function sendResendEmail(env, to, subject, html) {
  var res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + env.RESEND_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: env.SENDER_EMAIL, to: [to], subject: subject, html: html })
  })
  var data = await res.json()
  if (!res.ok) {
    throw new Error("Resend API error " + res.status + ": " + JSON.stringify(data))
  }
  return data
}

async function updateProspectAfterSend(env, pageId, step, isLastStep) {
  var today = todayISO()
  var properties = {
    "Trạng thái": { status: { name: "Đã gửi Email " + step } },
    "Ngày gửi gần nhất": { date: { start: today } },
    "Bước hiện tại": { number: step },
    "Ngày gửi tiếp theo": isLastStep ? { date: null } : { date: { start: addDaysISO(today, FOLLOWUP_DAYS) } }
  }
  await notionFetch(env, "/pages/" + pageId, {
    method: "PATCH",
    body: JSON.stringify({ properties: properties })
  })
}

async function processProspect(env, prospect) {
  var props = prospect.properties
  var hoTen = getTitle(props["Họ tên"])
  var congTy = getText(props["Công ty"])
  var chucDanh = getText(props["Chức danh"])
  var email = getEmail(props["Email"])
  var nganh = getSelect(props["Ngành"])
  var currentStep = getNumber(props["Bước hiện tại"])
  var nextStep = currentStep + 1

  if (!email) return { pageId: prospect.id, skipped: "no_email" }
  if (nextStep > MAX_STEPS) return { pageId: prospect.id, skipped: "max_steps_reached" }

  var template = await findTemplate(env, nextStep, nganh)
  if (!template) return { pageId: prospect.id, skipped: "no_template_for_step_" + nextStep }

  var subjectRaw = getText(template.properties["Tiêu đề Email"])
  var bodyRaw = await getPageBodyText(env, template.id)
  var vars = { HoTen: hoTen, Congty: congTy, Nganh: nganh, ChucDanh: chucDanh }
  var subject = fillTemplate(subjectRaw, vars)
  var bodyText = fillTemplate(bodyRaw, vars)
  var html = bodyText.split("\n").map(function (l) {
    return l ? "<p>" + l + "</p>" : "<p>&nbsp;</p>"
  }).join("\n")

  await sendResendEmail(env, email, subject, html)
  await updateProspectAfterSend(env, prospect.id, nextStep, nextStep >= MAX_STEPS)
  return { pageId: prospect.id, sentStep: nextStep, to: email }
}

async function runCampaignJob(env, campaignId) {
  var prospects = await queryDueProspectsForCampaign(env, campaignId)
  var results = []
  for (var i = 0; i < prospects.length; i++) {
    try {
      var r = await processProspect(env, prospects[i])
      results.push(r)
    } catch (err) {
      results.push({ pageId: prospects[i].id, error: String((err && err.message) || err) })
    }
  }
  return { campaignId: campaignId, total: prospects.length, results: results }
}

async function runAllActiveCampaigns(env) {
  var campaigns = await queryActiveCampaigns(env)
  var out = []
  for (var i = 0; i < campaigns.length; i++) {
    var c = campaigns[i]
    var name = getTitle(c.properties["Tên chiến dịch"])
    var r = await runCampaignJob(env, c.id)
    r.campaignName = name
    out.push(r)
  }
  return { totalActiveCampaigns: campaigns.length, campaigns: out }
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj, null, 2), {
    status: status || 200,
    headers: { "content-type": "application/json" }
  })
}

export default {
  async fetch(request, env) {
    var url = new URL(request.url)

    if (url.pathname === "/run" && (request.method === "POST" || request.method === "GET")) {
      var result = await runAllActiveCampaigns(env)
      return jsonResponse(result)
    }

    if (url.pathname === "/send-campaign" && (request.method === "POST" || request.method === "GET")) {
      var campaignId = url.searchParams.get("id")
      if (!campaignId) {
        return jsonResponse({ error: "missing_campaign_id" }, 400)
      }
      var campaign
      try {
        campaign = await getCampaign(env, campaignId)
      } catch (err) {
        return jsonResponse({ error: "campaign_not_found", message: String((err && err.message) || err) }, 404)
      }
      var status = getStatus(campaign.properties["Trạng thái"])
      if (status !== ACTIVE_CAMPAIGN_STATUS) {
        return jsonResponse({ error: "campaign_not_active", status: status }, 400)
      }
      var campaignResult = await runCampaignJob(env, campaignId)
      campaignResult.campaignName = getTitle(campaign.properties["Tên chiến dịch"])
      return jsonResponse(campaignResult)
    }

    return new Response("White Glove Cold Email Worker OK. Use POST/GET /run (all active campaigns) or /send-campaign?id=<campaignId>.", { status: 200 })
  }
}
