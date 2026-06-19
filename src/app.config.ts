export default defineAppConfig({
  pages: [
    'pages/inbound/index',
    'pages/outbound/index',
    'pages/query/index',
    'pages/inventory/index',
    'pages/adjustment/index'
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
        text: '术前备货'
      },
      {
        pagePath: 'pages/query/index',
        text: '批号查询'
      },
      {
        pagePath: 'pages/inventory/index',
        text: '月底盘点'
      },
      {
        pagePath: 'pages/adjustment/index',
        text: '库存调整'
      }
    ]
  }
})
