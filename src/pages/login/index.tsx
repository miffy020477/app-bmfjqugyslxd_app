import {useState} from 'react'
import Taro from '@tarojs/taro'
import {useAuth} from '@/contexts/AuthContext'

export default function LoginPage() {
  const {signInWithUsername} = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async () => {
    if (!username.trim()) {
      Taro.showToast({title: '请输入账号', icon: 'none'})
      return
    }
    if (!password.trim()) {
      Taro.showToast({title: '请输入密码', icon: 'none'})
      return
    }
    if (!agreed) {
      Taro.showToast({title: '请先同意用户协议和隐私政策', icon: 'none'})
      return
    }

    setLoading(true)
    try {
      const {error} = await signInWithUsername(username.trim(), password)
      if (error) {
        Taro.showToast({title: '账号或密码错误', icon: 'none'})
      } else {
        Taro.showToast({title: '登录成功', icon: 'success'})
        setTimeout(() => {
          const redirectPath = Taro.getStorageSync('loginRedirectPath')
          Taro.removeStorageSync('loginRedirectPath')
          if (redirectPath && !redirectPath.includes('/pages/login')) {
            Taro.redirectTo({url: redirectPath})
          } else {
            Taro.redirectTo({url: '/pages/admin/list/index'})
          }
        }, 1000)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部英雄区 */}
      <div className="bg-gradient-hero px-6 pt-16 pb-12 flex flex-col items-center">
        <div className="w-20 h-20 bg-white/20 rounded-xl flex items-center justify-center mb-4">
          <div className="i-mdi-shield-star text-4xl text-white" />
        </div>
        <p className="text-white text-2xl font-bold">派出所管理端</p>
        <p className="text-white/70 text-xl mt-1">所长 / 负责人登录</p>
      </div>

      {/* 登录表单 */}
      <div className="-mt-6 mx-4 bg-card rounded-xl shadow-card px-6 py-6">
        {/* 账号输入 */}
        <div className="mb-4">
          <p className="text-foreground text-xl font-bold mb-2">账号</p>
          <div className="border border-border rounded overflow-hidden bg-background flex items-center">
            <div className="i-mdi-account text-2xl text-muted-foreground ml-4" />
            <input
              className="flex-1 text-xl text-foreground bg-transparent outline-none px-3"
              style={{height: '48px'}}
              placeholder="请输入管理员账号"
              value={username}
              onInput={(e) => {
                const ev = e as any
                setUsername(ev.detail?.value ?? ev.target?.value ?? '')
              }}
            />
          </div>
        </div>

        {/* 密码输入 */}
        <div className="mb-6">
          <p className="text-foreground text-xl font-bold mb-2">密码</p>
          <div className="border border-border rounded overflow-hidden bg-background flex items-center">
            <div className="i-mdi-lock text-2xl text-muted-foreground ml-4" />
            <input
              className="flex-1 text-xl text-foreground bg-transparent outline-none px-3"
              style={{height: '48px'}}
              type={showPassword ? 'text' : 'password'}
              placeholder="请输入密码"
              value={password}
              onInput={(e) => {
                const ev = e as any
                setPassword(ev.detail?.value ?? ev.target?.value ?? '')
              }}
            />
            <div
              onClick={() => setShowPassword(!showPassword)}
              className={`text-2xl text-muted-foreground mr-4 ${showPassword ? 'i-mdi-eye' : 'i-mdi-eye-off'}`}
            />
          </div>
        </div>

        {/* 用户协议 */}
        <div
          className="flex items-center gap-2 mb-6"
          onClick={() => setAgreed(!agreed)}
        >
          <div
            className={`w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${
              agreed ? 'bg-primary border-primary' : 'border-border'
            }`}
          >
            {agreed && <div className="i-mdi-check text-xl text-white" />}
          </div>
          <div className="flex flex-wrap text-xl text-muted-foreground">
            <span>我已阅读并同意</span>
            <span className="text-primary">《用户协议》</span>
            <span>和</span>
            <span className="text-primary">《隐私政策》</span>
          </div>
        </div>

        {/* 登录按钮 */}
        <button
          type="button"
          onClick={handleLogin}
          className={`w-full flex items-center justify-center leading-none rounded text-2xl text-primary-foreground ${
            loading ? 'bg-primary/50' : 'bg-gradient-primary'
          }`}
        >
          <div className="py-4">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="i-mdi-loading text-2xl animate-spin" />
                <span>登录中...</span>
              </div>
            ) : (
              <span>登录管理后台</span>
            )}
          </div>
        </button>
      </div>

      {/* 市民入口提示 */}
      <div className="mx-4 mt-6 bg-secondary rounded p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="i-mdi-information text-2xl text-primary" />
          <p className="text-secondary-foreground text-xl font-bold">市民提交反馈</p>
        </div>
        <p className="text-muted-foreground text-xl">
          市民无需登录，扫描派出所专属二维码即可直接提交反馈。
        </p>
        <div
          onClick={() => Taro.switchTab({url: '/pages/submit/index'})}
          className="flex items-center gap-1 mt-2"
        >
          <span className="text-primary text-xl">进入市民反馈页面</span>
          <div className="i-mdi-arrow-right text-xl text-primary" />
        </div>
      </div>
    </div>
  )
}
