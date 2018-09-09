
angular

  .module('ManagementApp')

  .directive('statsView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/stats/stats.html',
      controller: 'StatsViewController'
    }
  })

  .controller('StatsViewController', function($scope, $stateParams, $http, $location, $interval) {
    $scope.busy = false
    $scope.timespan = 'daily'
    $scope.caseSort = "totalOpenings";
    $scope.caseOrder = "desc";
    $scope.autoRefreshSeconds = 10
    $scope.autoRefreshing = false

    $scope.mergedStats = {}
    $scope.cases = []

    $scope.caseSortToggle = function(){
      if($scope.caseSort == "profit") $scope.caseSort = "totalOpenings";
      else $scope.caseSort = "profit";
      $scope.refresh();
      $scope.autoRefreshSeconds = 10
    }
    $scope.caseOrderToggle = function(){
      if($scope.caseOrder == "asc") $scope.caseOrder = "desc";
      else $scope.caseOrder = "asc";
      $scope.refresh();
      $scope.autoRefreshSeconds = 10
    }

    $scope.refresh = function() {
      if($scope.busy) {
        return
      }

      $scope.busy = true
      $location.search('timespan', $scope.timespan).replace()

      $http

        .get('/_acp/stats', {
          params: {
            timespan: $scope.timespan,
            caseOrder: $scope.caseOrder,
            caseSort: $scope.caseSort
          }
        })

        .then(function(response) {
          $scope.mergedStats = response.data.mergedStats
          $scope.cases = response.data.cases
          $scope.busy = false
          $scope.autoRefreshing = false
        })
    }

    $interval(function() {
      if($scope.autoRefreshSeconds <= 0) {
        $scope.autoRefreshing = true
        $scope.autoRefreshSeconds = 10
        $scope.refresh()
      } else {
        $scope.autoRefreshSeconds--
      }
    }, 1000)

    $scope.refresh()
  })
