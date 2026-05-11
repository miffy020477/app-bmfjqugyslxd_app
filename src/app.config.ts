const pages = ['pages/home/index', 'pages/login/index']

//  To fully leverage TypeScript's type safety and ensure its correctness, always enclose the configuration object within the global defineAppConfig helper function.
export default defineAppConfig({
  pages,
  tabBar: {
    // List requires at least 2 items and at most 5 items
    list: [
      {
        pagePath: 'pages/home/index',
        text: 'Home'
      }
      // {
      //     pagePath: 'pages/welcome/index',
      //     text: 'welcome'
      // }
    ]
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: 'WeChat',
    navigationBarTextStyle: 'black'
  },
  // Location APIs: Use 'getFuzzyLocation' for fuzzy location (cannot combine with precise APIs),
  // or use precise APIs: 'getLocation', 'onLocationChange', 'startLocationUpdate', 'chooseLocation', 'choosePoi', 'chooseAddress'
  // Background location: 'startLocationUpdateBackground'. Other values are strictly prohibited.
  // requiredPrivateInfos: []
})
