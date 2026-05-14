import {useState, useCallback, useEffect, useMemo} from 'react'
import Taro from '@tarojs/taro'
import {Image} from '@tarojs/components'
import {supabase} from '@/client/supabase'
import {useAuth} from '@/contexts/AuthContext'
import {getFeedbackDetail, getFeedbackMessages, sendMessage, updateFeedbackStatus} from '@/db/api'
import type {Feedback, FeedbackImage, FeedbackStatus, Message} from '@/db/types'
import {FEEDBACK_STATUS_LABELS, FEEDBACK_TYPE_LABELS} from '@/db/types'
import {withRouteGuard} from '@/components/RouteGuard'

const STATUS_LIST: FeedbackStatus[] = ['pending', 'processing', 'completed']

function getStatusClass(status: FeedbackStatus): string {
  const map: Record<FeedbackStatus, string> = {
    pending: 'status-pending',
    processing: 'status-processing',
    completed: 'status-completed',
  }
  return map[status] || 'status-pending'
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function AdminDetailPage() {
  const {profile, user} = useAuth()
  const feedbackId = useMemo(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    return decodeURIComponent(params.id || '')
  }, [])

  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [images, setImages] = useState<FeedbackImage[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [sending, setSending] = useState(false)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)

  const loadData = useCallback(async () => {
    if (!feedbackId) return
    setLoading(true)
    try {
      const detail = await getFeedbackDetail(feedbackId)
      if (detail) {
        setFeedback(detail)
        setImages((detail.feedback_images as FeedbackImage[]) || [])
        setMessages((detail.messages as Message[]) || [])
      }
    } finally {
      setLoading(false)
    }
  }, [feedbackId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 实时消息订阅
  useEffect(() => {
    if (!feedbackId) return
    const channel = supabase
      .channel(`admin-messages-${feedbackId}`)
      .on(
        'postgres_changes',
        {event: 'INSERT', schema: 'public', table: 'messages', filter: `feedback_id=eq.${feedbackId}`},
        (payload) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === (payload.new as Message).id)
            if (exists) return prev
            return [...prev, payload.new as Message]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [feedbackId])

  const handleUpdateStatus = async (newStatus: FeedbackStatus) => {
    if (!feedback) return
    setUpdatingStatus(true)
    setShowStatusPicker(false)
    try {
      const ok = await updateFeedbackStatus(feedbackId, newStatus)
      if (ok) {
        setFeedback({...feedback, status: newStatus})
        Taro.showToast({title: '状态已更新', icon: 'success'})
      }
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleSendReply = async () => {
    if (!replyContent.trim()) {
      Taro.showToast({title: '请输入回复内容', icon: 'none'})
      return
    }
    if (!user || !feedback) return

    setSending(true)
    try {
      const msg = await sendMessage({
        feedback_id: feedbackId,
        user_id: user.id,
        sender_role: 'admin',
        content: replyContent.trim(),
      })
      if (msg) {
        setReplyContent('')
        Taro.showToast({title: '已回复市民', icon: 'success'})
      } else {
        Taro.showToast({title: '回复失败，请重试', icon: 'none'})
      }
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="i-mdi-loading text-4xl text-primary animate-spin" />
        <p className="text-muted-foreground text-xl mt-3">加载中...</p>
      </div>
    )
  }

  if (!feedback) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="i-mdi-alert-circle-outline text-4xl text-muted-foreground" />
        <p className="text-muted-foreground text-xl mt-3">反馈不存在</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* 顶部状态区 */}
      <div className="bg-gradient-hero px-6 pt-6 pb-8">
        <div className="flex items-center justify-between mb-3">
          <span className={`px-3 py-1 rounded text-xl font-bold ${getStatusClass(feedback.status)}`}>
            {FEEDBACK_STATUS_LABELS[feedback.status]}
          </span>
          <div
            onClick={() => setShowStatusPicker(true)}
            className="flex items-center gap-1 bg-white/20 rounded px-3 py-1"
          >
            <span className="text-white text-xl">更新状态</span>
            <div className="i-mdi-chevron-down text-xl text-white" />
          </div>
        </div>
        <p className="text-white text-2xl font-bold">{FEEDBACK_TYPE_LABELS[feedback.type]}</p>
        <p className="text-white/70 text-xl mt-1">
          提交时间：{formatTime(feedback.created_at)}
        </p>
      </div>

      {/* 状态选择弹窗 */}
      {showStatusPicker && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end"
          onClick={() => setShowStatusPicker(false)}
        >
          <div className="w-full bg-card rounded-t-xl pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <p className="text-foreground text-2xl font-bold">更新处理状态</p>
              <div
                onClick={() => setShowStatusPicker(false)}
                className="i-mdi-close text-2xl text-muted-foreground"
              />
            </div>
            {STATUS_LIST.map((s) => (
              <div
                key={s}
                onClick={() => handleUpdateStatus(s)}
                className={`flex items-center justify-between px-6 py-4 border-b border-border ${
                  feedback.status === s ? 'bg-secondary' : ''
                }`}
              >
                <span className={`text-xl ${getStatusClass(s)} px-3 py-1 rounded font-bold`}>
                  {FEEDBACK_STATUS_LABELS[s]}
                </span>
                {feedback.status === s && (
                  <div className="i-mdi-check text-2xl text-primary" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="-mt-4 mx-4 flex flex-col gap-4">
        {/* 反馈详情卡片 */}
        <div className="bg-card rounded shadow-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="i-mdi-text-box-outline text-2xl text-primary" />
            <p className="text-foreground text-xl font-bold">投诉详情</p>
          </div>
          <p className="text-foreground text-xl leading-relaxed">{feedback.description}</p>

          {feedback.contact && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
              <div className="i-mdi-phone text-2xl text-primary" />
              <span className="text-muted-foreground text-xl">联系方式：</span>
              <span className="text-foreground text-xl font-bold">{feedback.contact}</span>
            </div>
          )}
        </div>

        {/* 图片展示 */}
        {images.length > 0 && (
          <div className="bg-card rounded shadow-card p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="i-mdi-image-multiple text-2xl text-primary" />
              <p className="text-foreground text-xl font-bold">附件图片</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {images.map((img) => (
                <div key={img.id} style={{width: '30%', height: '28vw'}}>
                  <Image
                    src={img.url}
                    mode="aspectFill"
                    className="w-full h-full rounded"
                    onClick={() => {
                      Taro.previewImage({current: img.url, urls: images.map((i) => i.url)})
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 沟通记录 */}
        <div className="bg-card rounded shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="i-mdi-message-text text-2xl text-primary" />
            <p className="text-foreground text-xl font-bold">与市民沟通记录</p>
            <span className="text-muted-foreground text-xl">({messages.length}条)</span>
          </div>

          {messages.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <div className="i-mdi-chat-outline text-4xl text-muted-foreground" />
              <p className="text-muted-foreground text-xl mt-3">
                市民尚未留言，您可以主动回复进展情况
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg) => {
                const isCitizen = msg.sender_role === 'citizen'
                return (
                  <div key={msg.id} className={`flex gap-3 ${!isCitizen ? 'flex-row-reverse' : ''}`}>
                    {/* 头像 */}
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isCitizen ? 'bg-secondary' : 'bg-primary'
                      }`}
                    >
                      <div
                        className={`text-2xl ${
                          isCitizen ? 'i-mdi-account text-secondary-foreground' : 'i-mdi-shield-account text-primary-foreground'
                        }`}
                      />
                    </div>

                    <div className={`flex-1 flex flex-col ${!isCitizen ? 'items-end' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-muted-foreground text-xl">
                          {isCitizen ? '市民' : '派出所（我）'}
                        </span>
                        <span className="text-muted-foreground text-xl">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                      <div
                        className={`rounded p-3 text-xl ${
                          isCitizen
                            ? 'bg-secondary text-secondary-foreground'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* 底部回复输入区 */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 border border-border rounded overflow-hidden bg-background">
            <input
              className="w-full text-xl text-foreground bg-transparent outline-none px-4"
              style={{height: '44px'}}
              placeholder="回复市民，告知处理进展..."
              value={replyContent}
              onInput={(e) => {
                const ev = e as any
                setReplyContent(ev.detail?.value ?? ev.target?.value ?? '')
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleSendReply}
            className={`flex items-center justify-center leading-none rounded text-primary-foreground text-xl ${
              sending ? 'bg-primary/50' : 'bg-primary'
            }`}
            style={{width: '80px', height: '44px'}}
          >
            {sending ? (
              <div className="i-mdi-loading animate-spin text-2xl" />
            ) : (
              <span>回复</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default withRouteGuard(AdminDetailPage)
