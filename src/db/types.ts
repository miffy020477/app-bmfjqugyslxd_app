// 数据库类型定义

export type UserRole = 'user' | 'admin'
export type FeedbackStatus = 'pending' | 'processing' | 'completed'
export type FeedbackType = 'security' | 'traffic' | 'service' | 'other'
export type SenderRole = 'citizen' | 'admin'

export interface Profile {
  id: string
  username: string | null
  email: string | null
  role: UserRole
  openid: string | null
  station_id: string | null
  created_at: string
}

export interface PoliceStation {
  id: string
  name: string
  address: string | null
  district: string | null
  created_at: string
}

export interface Feedback {
  id: string
  station_id: string
  user_id: string
  type: FeedbackType
  description: string
  contact: string | null
  status: FeedbackStatus
  created_at: string
  updated_at: string
  // 关联数据
  police_stations?: PoliceStation
  feedback_images?: FeedbackImage[]
  messages?: Message[]
}

export interface FeedbackImage {
  id: string
  feedback_id: string
  url: string
  created_at: string
}

export interface Message {
  id: string
  feedback_id: string
  user_id: string
  sender_role: SenderRole
  content: string
  created_at: string
}

// 反馈类型标签映射
export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  security: '治安问题',
  traffic: '交通问题',
  service: '服务投诉',
  other: '其他',
}

// 反馈状态标签映射
export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  completed: '已完成',
}
