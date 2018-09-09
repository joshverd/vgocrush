
angular

  .module('ManagementApp')

  .directive('playerDeposits', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/players/deposits.html',
      controller: 'PlayerDeposits'
    }
  })

  .controller('PlayerDeposits', function($scope, $http, $state) {

    $scope.busy = false
    $scope.orders = []
    $scope.page = '1'

    $scope.refresh = function() {
      $scope.busy = true

      $http
        .get('/_acp/players/deposits', {
          params: {
            page: $scope.page
          }
        })

        .then(resp => {
          $scope.orders = resp.data.orders
          $scope.pages = Array.from({ length: resp.data.pages }).map((_, i) => i + 1)
        })

        .then(() => {
          $scope.busy = false
        })
    }

    $scope.onPageChange = function() {
      $scope.orders = []
      $scope.refresh()
    }

    $scope.refresh()
  })
