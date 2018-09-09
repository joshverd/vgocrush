
angular

  .module('ManagementApp')

  .directive('caseCreatorListView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/caseCreatorList/list.html',
      controller: 'CaseCreatorListController'
    }
  })

  .controller('CaseCreatorListController', function($scope, $stateParams, $http) {
    $scope.busy = false
    $scope.itemName = ''
    $scope.items = []

    $scope.refresh = function() {
      $http
        .get('/_acp/cases/items')
        .then(function(response) {
          $scope.items = response.data
        })
    }

    $scope.addItem = function() {
      $scope.busy = true

      $http.post('/_acp/cases/addItem', {
        itemName: $scope.itemName
      }).then(() => {
        $scope.itemName = ''
        $scope.busy = false

        UIkit.notification({
          message: 'Item successfully added!',
          status: 'success',
          timeout: 5000
        })

        $scope.refresh()
      }, () => {
        $scope.busy = false
      })
    }

    $scope.removeItem = function(itemName) {
      $scope.busy = true

      $http.post('/_acp/cases/removeItem', {
        itemName: itemName
      }).then(() => {
        $scope.busy = false

        UIkit.notification({
          message: 'Item successfully removed!',
          status: 'success',
          timeout: 5000
        })

        $scope.refresh()
      }, () => {
        $scope.busy = false
      })
    }

    $scope.refresh()
  })
