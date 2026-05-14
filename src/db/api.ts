import {supabase} from '@/client/supabase'
import type {
  Feedback,
  FeedbackImage,
  FeedbackStatus,
  FeedbackType,
  Message,
  PoliceStation,
  Profile,
} from './types'

// ========== 派出所 API ==========

/** 获取所有派出所列表 */
export async function getPoliceStations(): Promise<PoliceStation[]> {
  const {data, error} = await supabase
    .from('police_stations')
    .select('*')
    .order('created_at', {ascending: true})

  if (error) {
    console.error('获取派出所列表失败:', error)
    return []
  }
  return Array.isArray(data) ? data : []
}

/** 根据ID获取派出所 */
export async function getPoliceStationById(id: string): Promise<PoliceStation | null> {
  const {data, error} = await supabase
    .from('police_stations')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('获取派出所失败:', error)
    return null
  }
  return data
}

// ========== 反馈 API ==========

/** 提交新反馈（市民） */
export async function createFeedback(params: {
  station_id: string
  user_id: string
  type: FeedbackType
  description: string
  contact?: string
}): Promise<Feedback | null> {
  const {data, error} = await supabase
    .from('feedbacks')
    .insert({
      station_id: params.station_id,
      user_id: params.user_id,
      type: params.type,
      description: params.description,
      contact: params.contact || null,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('提交反馈失败:', error)
    return null
  }
  return data
}

/** 获取市民自己的反馈列表 */
export async function getMyFeedbacks(userId: string, cursor?: string): Promise<Feedback[]> {
  let query = supabase
    .from('feedbacks')
    .select('*, police_stations(id, name, district)')
    .eq('user_id', userId)
    .order('created_at', {ascending: false})
    .limit(20)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const {data, error} = await query

  if (error) {
    console.error('获取我的反馈失败:', error)
    return []
  }
  return Array.isArray(data) ? data : []
}

/** 获取管理员派出所的所有反馈 */
export async function getStationFeedbacks(
  stationId: string,
  status?: FeedbackStatus,
  cursor?: string
): Promise<Feedback[]> {
  let query = supabase
    .from('feedbacks')
    .select('*')
    .eq('station_id', stationId)
    .order('created_at', {ascending: false})
    .limit(20)

  if (status) {
    query = query.eq('status', status)
  }
  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const {data, error} = await query

  if (error) {
    console.error('获取派出所反馈列表失败:', error)
    return []
  }
  return Array.isArray(data) ? data : []
}

/** 获取反馈详情（含图片和消息） */
export async function getFeedbackDetail(feedbackId: string): Promise<Feedback | null> {
  const {data, error} = await supabase
    .from('feedbacks')
    .select('*, police_stations(id, name, address, district), feedback_images(*), messages(*)')
    .eq('id', feedbackId)
    .order('created_at', {referencedTable: 'messages', ascending: true})
    .maybeSingle()

  if (error) {
    console.error('获取反馈详情失败:', error)
    return null
  }
  return data
}

/** 更新反馈状态（管理员） */
export async function updateFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus
): Promise<boolean> {
  const {error} = await supabase
    .from('feedbacks')
    .update({status, updated_at: new Date().toISOString()})
    .eq('id', feedbackId)

  if (error) {
    console.error('更新反馈状态失败:', error)
    return false
  }
  return true
}

// ========== 图片 API ==========

/** 添加反馈图片 */
export async function addFeedbackImage(feedbackId: string, url: string): Promise<boolean> {
  const {error} = await supabase.from('feedback_images').insert({
    feedback_id: feedbackId,
    url,
  })

  if (error) {
    console.error('添加图片失败:', error)
    return false
  }
  return true
}

// ========== 消息 API ==========

/** 发送消息（市民或管理员） */
export async function sendMessage(params: {
  feedback_id: string
  user_id: string
  sender_role: 'citizen' | 'admin'
  content: string
}): Promise<Message | null> {
  const {data, error} = await supabase
    .from('messages')
    .insert({
      feedback_id: params.feedback_id,
      user_id: params.user_id,
      sender_role: params.sender_role,
      content: params.content,
    })
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('发送消息失败:', error)
    return null
  }
  return data
}

/** 获取反馈的消息列表 */
export async function getFeedbackMessages(feedbackId: string): Promise<Message[]> {
  const {data, error} = await supabase
    .from('messages')
    .select('*')
    .eq('feedback_id', feedbackId)
    .order('created_at', {ascending: true})

  if (error) {
    console.error('获取消息列表失败:', error)
    return []
  }
  return Array.isArray(data) ? data : []
}

// ========== 用户档案 API ==========

/** 获取用户档案 */
export async function getProfileById(userId: string): Promise<Profile | null> {
  const {data, error} = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('获取档案失败:', error)
    return null
  }
  return data
}

/** 获取反馈图片列表 */
export async function getFeedbackImages(feedbackId: string): Promise<FeedbackImage[]> {
  const {data, error} = await supabase
    .from('feedback_images')
    .select('*')
    .eq('feedback_id', feedbackId)
    .order('created_at', {ascending: true})

  if (error) {
    console.error('获取图片列表失败:', error)
    return []
  }
  return Array.isArray(data) ? data : []
}
