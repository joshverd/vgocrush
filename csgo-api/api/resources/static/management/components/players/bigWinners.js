
angular

  .module('ManagementApp')

  .directive('playerBigWins', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/players/bigWinners.html',
      controller: 'PlayersBigWinnerControl'
    }
  })

  .controller('PlayersBigWinnerControl', function($scope, $http, $state) {

    $scope.busy = false
    $scope.opens = []

    $scope.refresh = function() {
      $scope.busy = true

      $http
        .get('/_acp/players/wins')

        .then(resp => {
          $scope.opens = resp.data.opens
        })

        .then(() => {
          $scope.busy = false
        })
    }

    $scope.refresh()
  })
