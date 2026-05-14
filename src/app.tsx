/**
 * @file Taro 应用入口文件
 */

import type React from 'react'
import type {PropsWithChildren} from 'react'
import {useTabBarPageClass} from '@/hooks/useTabBarPageClass'
import {AuthProvider} from '@/contexts/AuthContext'

import './app.scss'

const App: React.FC = ({children}: PropsWithChildren<unknown>) => {
  useTabBarPageClass()

  return <AuthProvider>{children}</AuthProvider>
}

export default App
