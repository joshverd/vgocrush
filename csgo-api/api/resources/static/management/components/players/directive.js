
angular

  .module('ManagementApp')

  .directive('playersView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/players/players.html',
      controller: 'PlayersViewController'
    }
  })

  .controller('PlayersViewController', function($scope, $http, $state) {
    $scope.largeDeposits = []
    $scope.largeWithdraws = []
    $scope.statistics = {}

    $scope.viewProfile = function(steamId64) {
      $state.go('player', {
        id: steamId64
      })
    }

    $http
      .get('/_acp/players')
      .then(resp => {
        $scope.statistics = resp.data
      })

    $http
      .get('/_acp/players/largeDeposits')
      .then(resp => {
        $scope.largeDeposits = resp.data
      })

      $http
        .get('/_acp/players/largeWithdraws')
        .then(resp => {
          $scope.largeWithdraws = resp.data
        })
  })
