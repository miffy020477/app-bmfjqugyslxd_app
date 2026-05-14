const pages = [
  'pages/submit/index',
  'pages/my-feedbacks/index',
  'pages/feedback-detail/index',
  'pages/login/index',
  'pages/admin/list/index',
  'pages/admin/detail/index',
]

export default defineAppConfig({
  pages,
  tabBar: {
    color: '#666666',
    selectedColor: '#1565C0',
    backgroundColor: '#FFFFFF',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/submit/index',
        text: '投诉反馈',
        iconPath: './assets/icons/submit_unselected.png',
        selectedIconPath: './assets/icons/submit_selected.png',
      },
      {
        pagePath: 'pages/my-feedbacks/index',
        text: '我的反馈',
        iconPath: './assets/icons/list_unselected.png',
        selectedIconPath: './assets/icons/list_selected.png',
      },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1565C0',
    navigationBarTitleText: '派出所直通反馈',
    navigationBarTextStyle: 'white',
  },
  permission: {},
})
