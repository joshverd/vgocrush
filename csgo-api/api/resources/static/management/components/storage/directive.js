
angular

  .module('ManagementApp')

  .directive('storageView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/storage/storage.html',
      controller: 'StorageController'
    }
  })

  .controller('StorageController', function($scope, $http) {
    $scope.bots = []

    $http
      .get('/_acp/storage')
      .then(resp => {
        $scope.bots = resp.data
      })
  })
