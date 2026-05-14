import {useState, useEffect, useCallback, useMemo} from 'react'
import Taro, {useShareAppMessage, useShareTimeline} from '@tarojs/taro'
import {Image, Picker} from '@tarojs/components'
import {supabase} from '@/client/supabase'
import {signInAnonymously} from '@/contexts/AuthContext'
import {createFeedback, addFeedbackImage, getPoliceStationById, getPoliceStations} from '@/db/api'
import type {FeedbackType, PoliceStation} from '@/db/types'
import {FEEDBACK_TYPE_LABELS} from '@/db/types'
import {selectMediaFiles, uploadToSupabase} from '@/utils/upload'

const FEEDBACK_TYPES: FeedbackType[] = ['security', 'traffic', 'service', 'other']
const TYPE_OPTIONS = FEEDBACK_TYPES.map((t) => FEEDBACK_TYPE_LABELS[t])

export default function SubmitPage() {
  useShareAppMessage(() => ({title: '派出所直通反馈', path: '/pages/submit/index'}))
  useShareTimeline(() => ({title: '派出所直通反馈'}))

  // 从扫码二维码获取 station_id 参数
  const stationId = useMemo(() => {
    const params = Taro.getCurrentInstance().router?.params
    return params?.station_id ? decodeURIComponent(params.station_id) : ''
  }, [])

  const [station, setStation] = useState<PoliceStation | null>(null)
  const [allStations, setAllStations] = useState<PoliceStation[]>([])
  const [selectedStationIndex, setSelectedStationIndex] = useState(0)
  const [selectedTypeIndex, setSelectedTypeIndex] = useState(0)
  const [description, setDescription] = useState('')
  const [contact, setContact] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [authReady, setAuthReady] = useState(false)

  // 初始化匿名登录
  const initAuth = useCallback(async () => {
    const {data: {session}} = await supabase.auth.getSession()
    if (session) {
      setAuthReady(true)
      return
    }
    const {error} = await signInAnonymously()
    if (error) {
      console.error('匿名登录失败:', error)
      Taro.showToast({title: '初始化失败，请重试', icon: 'none'})
    } else {
      setAuthReady(true)
    }
  }, [])

  // 加载派出所信息
  const loadStation = useCallback(async () => {
    if (stationId) {
      const s = await getPoliceStationById(stationId)
      setStation(s)
    } else {
      const list = await getPoliceStations()
      setAllStations(list)
      if (list.length > 0) setStation(list[0])
    }
  }, [stationId])

  useEffect(() => {
    initAuth()
    loadStation()
  }, [initAuth, loadStation])

  // 选择图片
  const handleSelectImages = async () => {
    if (images.length >= 3) {
      Taro.showToast({title: '最多上传3张图片', icon: 'none'})
      return
    }
    const files = await selectMediaFiles({count: 3 - images.length, mediaType: ['image']})
    if (files.length > 0) {
      const newPaths = files.map((f) => (f as any).tempFilePath as string)
      setImages((prev) => [...prev, ...newPaths].slice(0, 3))
    }
  }

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const currentStation = stationId ? station : allStations[selectedStationIndex] || null

  // 提交反馈
  const handleSubmit = async () => {
    if (!description.trim()) {
      Taro.showToast({title: '请填写事件描述', icon: 'none'})
      return
    }
    if (!currentStation) {
      Taro.showToast({title: '请选择派出所', icon: 'none'})
      return
    }
    if (!authReady) {
      Taro.showToast({title: '正在初始化，请稍候', icon: 'none'})
      return
    }

    setSubmitting(true)
    try {
      const {data: {session}} = await supabase.auth.getSession()
      if (!session?.user) throw new Error('未登录')

      const feedback = await createFeedback({
        station_id: currentStation.id,
        user_id: session.user.id,
        type: FEEDBACK_TYPES[selectedTypeIndex],
        description: description.trim(),
        contact: contact.trim() || undefined,
      })

      if (!feedback) throw new Error('提交失败')

      // 上传图片
      for (const imgPath of images) {
        const file = {tempFilePath: imgPath, name: `img_${Date.now()}.jpg`, type: 'image/jpeg'}
        const result = await uploadToSupabase(file as any, {
          bucket: 'feedback-images',
          userId: session.user.id,
        })
        if (result.success && result.data) {
          const {data: urlData} = supabase.storage
            .from('feedback-images')
            .getPublicUrl(result.data.path)
          await addFeedbackImage(feedback.id, urlData.publicUrl)
        }
      }

      Taro.showToast({title: '提交成功', icon: 'success'})
      setDescription('')
      setContact('')
      setImages([])
      setTimeout(() => {
        Taro.switchTab({url: '/pages/my-feedbacks/index'})
      }, 1500)
    } catch (err) {
      console.error('提交反馈失败:', err)
      Taro.showToast({title: '提交失败，请重试', icon: 'none'})
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* 顶部英雄区 */}
      <div className="bg-gradient-hero px-6 pt-8 pb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded flex items-center justify-center">
            <div className="i-mdi-shield-account text-2xl text-white" />
          </div>
          <div>
            <p className="text-white text-2xl font-bold">直通反馈</p>
            <p className="text-white/70 text-xl">无需拨打热线，直达派出所</p>
          </div>
        </div>
      </div>

      {/* 表单卡片 */}
      <div className="-mt-4 mx-4 bg-card rounded shadow-card">
        {/* 派出所信息 */}
        <div className="px-5 pt-5 pb-4 border-b border-border">
          <p className="text-muted-foreground text-xl mb-3">反馈至</p>
          {stationId ? (
            <div className="flex items-center gap-3">
              <div className="i-mdi-map-marker text-2xl text-primary" />
              <div>
                <p className="text-foreground text-2xl font-bold">
                  {station?.name || '加载中...'}
                </p>
                <p className="text-muted-foreground text-xl">{station?.district}</p>
              </div>
            </div>
          ) : (
            <Picker
              mode="selector"
              range={allStations.map((s) => `${s.district || ''} ${s.name}`)}
              value={selectedStationIndex}
              onChange={(e) => {
                const ev = e as any
                const idx = ev.detail?.value ?? ev.target?.value ?? 0
                setSelectedStationIndex(Number(idx))
              }}
            >
              <div className="flex items-center justify-between border border-border rounded px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="i-mdi-map-marker text-2xl text-primary" />
                  <span className="text-foreground text-xl">
                    {currentStation
                      ? `${currentStation.district || ''} ${currentStation.name}`
                      : '请选择派出所'}
                  </span>
                </div>
                <div className="i-mdi-chevron-right text-2xl text-muted-foreground" />
              </div>
            </Picker>
          )}
        </div>

        {/* 反馈类型 */}
        <div className="px-5 pt-4 pb-4 border-b border-border">
          <p className="text-foreground text-xl font-bold mb-3">
            <span>反馈类型</span>
            <span className="text-destructive ml-1">*</span>
          </p>
          <div className="flex flex-wrap gap-3">
            {FEEDBACK_TYPES.map((type, idx) => (
              <div
                key={type}
                onClick={() => setSelectedTypeIndex(idx)}
                className={`px-4 py-2 rounded border text-xl transition ${
                  selectedTypeIndex === idx
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'bg-card border-border text-foreground'
                }`}
              >
                {FEEDBACK_TYPE_LABELS[type]}
              </div>
            ))}
          </div>
        </div>

        {/* 事件描述 */}
        <div className="px-5 pt-4 pb-4 border-b border-border">
          <p className="text-foreground text-xl font-bold mb-3">
            <span>事件描述</span>
            <span className="text-destructive ml-1">*</span>
          </p>
          <div className="border border-border rounded overflow-hidden bg-background">
            <textarea
              className="w-full text-xl text-foreground bg-transparent outline-none p-3"
              placeholder="请详细描述您遇到的问题，包括时间、地点、经过等..."
              style={{height: '22vw', minHeight: '88px'}}
              value={description}
              onInput={(e) => {
                const ev = e as any
                setDescription(ev.detail?.value ?? ev.target?.value ?? '')
              }}
            />
          </div>
          <p className="text-muted-foreground text-xl mt-2 text-right">{description.length}/500</p>
        </div>

        {/* 上传图片 */}
        <div className="px-5 pt-4 pb-4 border-b border-border">
          <p className="text-foreground text-xl font-bold mb-3">上传图片（选填，最多3张）</p>
          <div className="flex flex-wrap gap-3">
            {images.map((img, idx) => (
              <div key={idx} className="relative" style={{width: '30%', aspectRatio: '1'}}>
                <Image
                  src={img}
                  mode="aspectFill"
                  className="w-full rounded"
                  style={{height: '28vw'}}
                />
                <div
                  onClick={() => handleRemoveImage(idx)}
                  className="absolute top-1 right-1 w-6 h-6 bg-foreground/60 rounded-full flex items-center justify-center"
                >
                  <div className="i-mdi-close text-xl text-white" />
                </div>
              </div>
            ))}
            {images.length < 3 && (
              <div
                onClick={handleSelectImages}
                className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded"
                style={{width: '30%', height: '28vw'}}
              >
                <div className="i-mdi-camera-plus text-2xl text-muted-foreground" />
                <span className="text-muted-foreground text-xl mt-1">添加图片</span>
              </div>
            )}
          </div>
        </div>

        {/* 联系方式 */}
        <div className="px-5 pt-4 pb-5">
          <p className="text-foreground text-xl font-bold mb-3">联系方式（选填）</p>
          <div className="border border-border rounded overflow-hidden bg-background">
            <input
              className="w-full text-xl text-foreground bg-transparent outline-none px-4"
              style={{height: '44px'}}
              placeholder="手机号或姓名，便于工作人员联系"
              value={contact}
              onInput={(e) => {
                const ev = e as any
                setContact(ev.detail?.value ?? ev.target?.value ?? '')
              }}
            />
          </div>
        </div>
      </div>

      {/* 提交按钮 */}
      <div className="mx-4 mt-6">
        <button
          type="button"
          onClick={handleSubmit}
          className={`w-full flex items-center justify-center leading-none text-2xl text-primary-foreground rounded ${
            submitting ? 'bg-primary/50' : 'bg-gradient-primary'
          }`}
        >
          <div className="py-4">
            {submitting ? (
              <div className="flex items-center gap-2">
                <div className="i-mdi-loading text-2xl animate-spin" />
                <span>提交中...</span>
              </div>
            ) : (
              <span>提交反馈</span>
            )}
          </div>
        </button>
      </div>

      <p className="text-center text-muted-foreground text-xl mt-4 px-6">
        您的反馈将直接发送给派出所负责人，无需逐级转报
      </p>
    </div>
  )
}
