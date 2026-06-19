export default defineAppConfig({
  pages: [
    'pages/inbound/index',
    'pages/outbound/index',
    'pages/query/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#1677FF',
    navigationBarTitleText: '种植体管理',
    navigationBarTextStyle: 'white',
    backgroundColor: '#F5F7FA'
  },
  tabBar: {
    color: '#86909C',
    selectedColor: '#1677FF',
    backgroundColor: '#FFFFFF',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/inbound/index',
        text: '入库登记'
      },
      {
        pagePath: 'pages/outbound/index',
        text: '椅旁领用'
      },
      {
        pagePath: 'pages/query/index',
        text: '批号查询'
      }
    ]
  }
})
