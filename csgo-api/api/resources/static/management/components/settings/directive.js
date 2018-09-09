
angular

  .module('ManagementApp')

  .directive('settingsView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/settings/settings.html',
      controller: 'SettingsViewController'
    }
  })

  .controller('SettingsViewController', function($scope, $stateParams, $http) {
    $scope.settings = null

    $scope.$watch('settings', function(newVal, oldVal) {
      if(!oldVal) {
        return
      }

      const update = {}

      for(let k in newVal) {
        if(newVal[k] !== oldVal[k]) {
          update[k] = newVal[k]
        }
      }

      if(Object.keys(update).length) {
        $http.post('/_acp/settings', update).then(() => {
          UIkit.notification({
            message: 'Settings successfully updated',
            status: 'success',
            timeout: 5000
          })
        })
      }
    }, true)

    $http
      .get('/_acp/settings')
      .then(function(res) {
        $scope.settings = res.data
      })
  })
