
angular

  .module('ManagementApp')

  .directive('statsView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/stats/stats.html',
      controller: 'StatsViewController'
    }
  })

  .controller('StatsViewController', function($scope, $stateParams, $http) {

    $scope.refresh = function() {
      $http.get('/_acp/stats')
    }
  })
