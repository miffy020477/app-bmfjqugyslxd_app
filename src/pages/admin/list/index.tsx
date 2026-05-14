import {useState, useCallback, useEffect} from 'react'
import Taro, {useDidShow} from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'
import {getStationFeedbacks} from '@/db/api'
import type {Feedback, FeedbackStatus} from '@/db/types'
import {FEEDBACK_STATUS_LABELS, FEEDBACK_TYPE_LABELS} from '@/db/types'
import {withRouteGuard} from '@/components/RouteGuard'

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

function AdminListPage() {
  const {profile, user, signOut} = useAuth()
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([])
  const [activeTab, setActiveTab] = useState<FeedbackStatus | 'all'>('all')
  const [loading, setLoading] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const stationId = profile?.station_id as string | null

  const loadFeedbacks = useCallback(async () => {
    if (!isAdmin || !stationId) return
    setLoading(true)
    try {
      const list = await getStationFeedbacks(stationId)
      setFeedbacks(list)
    } finally {
      setLoading(false)
    }
  }, [isAdmin, stationId])

  useEffect(() => {
    if (!user) {
      Taro.redirectTo({url: '/pages/login/index'})
      return
    }
    if (profile && !isAdmin) {
      Taro.showToast({title: '无管理员权限', icon: 'none'})
      Taro.redirectTo({url: '/pages/submit/index'})
      return
    }
    loadFeedbacks()
  }, [loadFeedbacks, user, profile, isAdmin])

  useDidShow(() => {
    loadFeedbacks()
  })

  const handleSignOut = async () => {
    await signOut()
    Taro.reLaunch({url: '/pages/login/index'})
  }

  const handleViewDetail = (id: string) => {
    Taro.navigateTo({url: `/pages/admin/detail/index?id=${encodeURIComponent(id)}`})
  }

  const filtered =
    activeTab === 'all' ? feedbacks : feedbacks.filter((f) => f.status === activeTab)

  const pendingCount = feedbacks.filter((f) => f.status === 'pending').length

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部管理头 */}
      <div className="bg-gradient-hero px-6 pt-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="i-mdi-shield-account text-2xl text-white" />
            <p className="text-white text-xl">管理员</p>
          </div>
          <div
            onClick={handleSignOut}
            className="flex items-center gap-1 bg-white/20 rounded px-3 py-1"
          >
            <div className="i-mdi-logout text-xl text-white" />
            <span className="text-white text-xl">退出</span>
          </div>
        </div>

        <p className="text-white text-2xl font-bold">反馈管理后台</p>

        <div className="flex gap-3 mt-4">
          <div className="flex-1 bg-white/15 rounded px-3 py-2">
            <p className="text-white/70 text-xl">全部反馈</p>
            <p className="text-white text-2xl font-bold">{feedbacks.length}</p>
          </div>
          <div className="flex-1 bg-white/15 rounded px-3 py-2">
            <p className="text-white/70 text-xl">待处理</p>
            <p className="text-accent text-2xl font-bold">{pendingCount}</p>
          </div>
          <div className="flex-1 bg-white/15 rounded px-3 py-2">
            <p className="text-white/70 text-xl">已完成</p>
            <p className="text-white text-2xl font-bold">
              {feedbacks.filter((f) => f.status === 'completed').length}
            </p>
          </div>
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
              {tab.value === 'pending' && pendingCount > 0 && (
                <span className="ml-1 text-xl text-accent font-bold">({pendingCount})</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 反馈列表 */}
      <div className="px-4 pt-4">
        {!isAdmin ? (
          <div className="flex flex-col items-center py-16">
            <div className="i-mdi-lock text-4xl text-muted-foreground" />
            <p className="text-muted-foreground text-xl mt-3">需要管理员权限</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center py-16">
            <div className="i-mdi-loading text-4xl text-primary animate-spin" />
            <p className="text-muted-foreground text-xl mt-3">加载中...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="i-mdi-clipboard-check text-4xl text-muted-foreground" />
            <p className="text-muted-foreground text-xl mt-3">
              {activeTab === 'all' ? '暂无反馈记录' : `暂无${FEEDBACK_STATUS_LABELS[activeTab as FeedbackStatus]}反馈`}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 pb-4">
            {filtered.map((feedback) => (
              <div
                key={feedback.id}
                onClick={() => handleViewDetail(feedback.id)}
                className="bg-card rounded shadow-card p-4"
              >
                {/* 头部 */}
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

                {/* 描述 */}
                <p className="text-foreground text-xl mb-3 line-clamp-2">{feedback.description}</p>

                {/* 联系方式 */}
                {feedback.contact && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="i-mdi-phone text-xl text-muted-foreground" />
                    <span className="text-muted-foreground text-xl">{feedback.contact}</span>
                  </div>
                )}

                {/* 时间 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <div className="i-mdi-clock-outline text-xl text-muted-foreground" />
                    <span className="text-muted-foreground text-xl">{formatDate(feedback.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-primary text-xl">处理</span>
                    <div className="i-mdi-chevron-right text-xl text-primary" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default withRouteGuard(AdminListPage)
