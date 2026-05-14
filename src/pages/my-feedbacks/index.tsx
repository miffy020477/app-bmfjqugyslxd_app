import {useState, useCallback, useEffect} from 'react'
import Taro, {useDidShow, useShareAppMessage, useShareTimeline} from '@tarojs/taro'
import {supabase} from '@/client/supabase'
import {signInAnonymously} from '@/contexts/AuthContext'
import {getMyFeedbacks} from '@/db/api'
import type {Feedback, FeedbackStatus} from '@/db/types'
import {FEEDBACK_STATUS_LABELS, FEEDBACK_TYPE_LABELS} from '@/db/types'

const STATUS_TABS: Array<{label: string; value: FeedbackStatus | 'all'}> = [
  {label: '全部', value: 'all'},
  {label: '待处理', value: 'pending'},
  {label: '处理中', value: 'processing'},
  {label: '已完成', value: 'completed'},
]

function getStatusClass(status: FeedbackStatus): string {
  const map: Record<FeedbackStatus, string> = {
    pending: 'status-pending',
    processing: 'status-processing',
    completed: 'status-completed',
  }
  return map[status] || 'status-pending'
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function MyFeedbacksPage() {
  useShareAppMessage(() => ({title: '我的反馈记录', path: '/pages/my-feedbacks/index'}))
  useShareTimeline(() => ({title: '我的反馈记录'}))

  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [activeTab, setActiveTab] = useState<FeedbackStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)

  const initAndLoad = useCallback(async () => {
    setLoading(true)
    try {
      let {data: {session}} = await supabase.auth.getSession()
      if (!session) {
        const {error} = await signInAnonymously()
        if (error) {
          Taro.showToast({title: '初始化失败', icon: 'none'})
          return
        }
        const result = await supabase.auth.getSession()
        session = result.data.session
      }

      if (!session?.user) return

      const list = await getMyFeedbacks(session.user.id)
      setFeedbacks(list)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    initAndLoad()
  }, [initAndLoad])

  useDidShow(() => {
    initAndLoad()
  })

  const filtered =
    activeTab === 'all' ? feedbacks : feedbacks.filter((f) => f.status === activeTab)

  const handleViewDetail = (id: string) => {
    Taro.navigateTo({url: `/pages/feedback-detail/index?id=${id}&role=citizen`})
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 统计头部 */}
      <div className="bg-gradient-hero px-6 pt-6 pb-8">
        <p className="text-white/80 text-xl mb-1">我的投诉与反馈</p>
        <p className="text-white text-2xl font-bold">共 {feedbacks.length} 条记录</p>
        <div className="flex gap-4 mt-4">
          {(['pending', 'processing', 'completed'] as FeedbackStatus[]).map((s) => {
            const count = feedbacks.filter((f) => f.status === s).length
            return (
              <div key={s} className="flex-1 bg-white/15 rounded px-3 py-2">
                <p className="text-white/70 text-xl">{FEEDBACK_STATUS_LABELS[s]}</p>
                <p className="text-white text-2xl font-bold">{count}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* 状态筛选标签 */}
      <div className="bg-card sticky top-0 z-10 border-b border-border">
        <div className="flex">
          {STATUS_TABS.map((tab) => (
            <div
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-1 py-4 text-center text-xl transition ${
                activeTab === tab.value
                  ? 'text-primary border-b-2 border-primary font-bold'
                  : 'text-muted-foreground'
              }`}
            >
              {tab.label}
            </div>
          ))}
        </div>
      </div>

      {/* 反馈列表 */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex flex-col items-center py-16">
            <div className="i-mdi-loading text-4xl text-primary animate-spin" />
            <p className="text-muted-foreground text-xl mt-3">加载中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="i-mdi-clipboard-text-outline text-4xl text-muted-foreground" />
            <p className="text-muted-foreground text-xl mt-3">暂无反馈记录</p>
            <button
              type="button"
              onClick={() => Taro.switchTab({url: '/pages/submit/index'})}
              className="mt-4 flex items-center justify-center leading-none bg-primary text-primary-foreground rounded text-xl"
            >
              <div className="px-6 py-3">去提交反馈</div>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {filtered.map((feedback) => (
              <div
                key={feedback.id}
                onClick={() => handleViewDetail(feedback.id)}
                className="bg-card rounded shadow-card p-4"
              >
                {/* 头部：类型 + 状态 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="i-mdi-tag text-2xl text-primary" />
                    <span className="text-foreground text-xl font-bold">
                      {FEEDBACK_TYPE_LABELS[feedback.type]}
                    </span>
                  </div>
                  <span className={`px-3 py-1 rounded text-xl font-bold ${getStatusClass(feedback.status)}`}>
                    {FEEDBACK_STATUS_LABELS[feedback.status]}
                  </span>
                </div>

                {/* 描述摘要 */}
                <p className="text-foreground text-xl mb-3 line-clamp-2">
                  {feedback.description}
                </p>

                {/* 底部信息 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <div className="i-mdi-map-marker text-xl text-muted-foreground" />
                    <span className="text-muted-foreground text-xl">
                      {(feedback.police_stations as any)?.name || '加载中...'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="i-mdi-clock-outline text-xl text-muted-foreground" />
                    <span className="text-muted-foreground text-xl">
                      {formatDate(feedback.created_at)}
                    </span>
                  </div>
                </div>

                {/* 查看详情提示 */}
                <div className="flex items-center justify-end mt-3">
                  <span className="text-primary text-xl">查看详情</span>
                  <div className="i-mdi-chevron-right text-xl text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 管理员入口（隐蔽，底部小字） */}
      <div className="flex justify-center py-8">
        <div
          onClick={() => Taro.navigateTo({url: '/pages/login/index'})}
          className="flex items-center gap-1"
        >
          <div className="i-mdi-shield-key text-xl text-muted-foreground" />
          <span className="text-muted-foreground text-xl">管理员入口</span>
        </div>
      </div>
    </div>
  )
}
