const path = require('path')

// @react-native-community/datetimepicker 8.6.0 的 Package 类继承 BaseReactPackage，
// RN CLI 15 的类名扫描正则识别不到，导致 autolinking 判定 android: null、
// 原生模块未注册、日期/时间选择器调用静默失败。此处显式补全 android 配置。
const dtpRoot = path.dirname(require.resolve('@react-native-community/datetimepicker/package.json'))

module.exports = {
  dependencies: {
    '@react-native-community/datetimepicker': {
      platforms: {
        android: {
          sourceDir: path.join(dtpRoot, 'android'),
          packageImportPath: 'import com.reactcommunity.rndatetimepicker.RNDateTimePickerPackage;',
          packageInstance: 'new RNDateTimePickerPackage()',
          buildTypes: [],
        },
      },
    },
  },
}
