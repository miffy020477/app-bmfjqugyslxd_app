import {createContext, useContext, useEffect, useState, type ReactNode} from 'react'
import Taro from '@tarojs/taro'
import {supabase} from '@/client/supabase'
import type {User} from '@supabase/supabase-js'
import type {Profile} from '@/db/types'

export type {Profile}

export async function getProfile(userId: string): Promise<Profile | null> {
  const {data, error} = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

  if (error) {
    console.error('获取用户档案失败:', error)
    return null
  }
  return data
}

// 匿名登录：根据设备凭证ID自动登录
export async function signInAnonymously(): Promise<{error: Error | null}> {
  try {
    let credentialId = Taro.getStorageSync('anon_credential_id')
    if (!credentialId) {
      // 生成新的设备凭证ID
      const arr = new Uint8Array(16)
      for (let i = 0; i < 16; i++) {
        arr[i] = Math.floor(Math.random() * 256)
      }
      const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
      credentialId = `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`
      Taro.setStorageSync('anon_credential_id', credentialId)
    }

    const {data, error} = await supabase.functions.invoke('anon-auth', {
      body: {credential_id: credentialId},
    })

    if (error) {
      const errMsg = (await error?.context?.text?.()) || error.message
      throw new Error(errMsg)
    }

    const {error: verifyError} = await supabase.auth.verifyOtp({
      token_hash: data.hashed_token,
      type: 'magiclink',
    })

    if (verifyError) throw verifyError
    return {error: null}
  } catch (err) {
    return {error: err as Error}
  }
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  signInWithUsername: (username: string, password: string) => Promise<{error: Error | null}>
  signUpWithUsername: (username: string, password: string) => Promise<{error: Error | null}>
  signUpWithPhone: (phone: string, password: string) => Promise<{error: Error | null}>
  signInWithPhone: (phone: string) => Promise<{error: Error | null}>
  verifyPhoneOtp: (phone: string, code: string) => Promise<{error: Error | null}>
  signInWithWechat: () => Promise<{error: Error | null}>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({children}: {children: ReactNode}) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null)
      return
    }

    const profileData = await getProfile(user.id)
    setProfile(profileData)
  }

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({data: {session}}) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          getProfile(session.user.id).then(setProfile)
        }
        setLoading(false)
      })
      .catch((error) => {
        console.warn('Failed to get session:', error)
        setUser(null)
        setProfile(null)
        setLoading(false)
      })

    // In this function, do NOT use any await calls. Use `.then()` instead to avoid deadlocks.
    const {
      data: {subscription}
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        getProfile(session.user.id).then(setProfile)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`
      const {error} = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  const signUpWithUsername = async (username: string, password: string) => {
    try {
      const email = `${username}@miaoda.com`
      const {error} = await supabase.auth.signUp({
        email,
        password,
        options: {data: {username}}
      })

      if (error) throw error
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  const signUpWithPhone = async (phone: string, password: string) => {
    try {
      const {error} = await supabase.auth.signUp({
        phone,
        password
      })

      if (error) throw error
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  const signInWithPhone = async (phone: string) => {
    try {
      const {error} = await supabase.auth.signInWithOtp({phone})

      if (error) throw error
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  const verifyPhoneOtp = async (phone: string, code: string) => {
    try {
      const {error} = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: 'sms'
      })
      if (error) throw error
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  const signInWithWechat = async () => {
    try {
      // Check if running in WeChat Mini Program environment
      if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP) {
        throw new Error('仅支持微信小程序登录，网页端请使用用户名密码登录')
      }

      // Get WeChat login code
      const loginResult = await Taro.login()

      // Call backend Edge Function for login
      const {data, error} = await supabase.functions.invoke('wechat_miniapp_login', {
        body: {code: loginResult?.code}
      })

      if (error) {
        const errorMsg = (await error?.context?.text?.()) || error.message
        throw new Error(errorMsg)
      }

      // Verify OTP token
      const {error: verifyError} = await supabase.auth.verifyOtp({
        token_hash: data.token,
        type: 'magiclink'
      })

      if (verifyError) throw verifyError
      return {error: null}
    } catch (error) {
      return {error: error as Error}
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithUsername,
        signUpWithUsername,
        signUpWithPhone,
        signInWithPhone,
        verifyPhoneOtp,
        signInWithWechat,
        signOut,
        refreshProfile
      }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
