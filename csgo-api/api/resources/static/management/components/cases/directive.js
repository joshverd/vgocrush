
angular

  .module('ManagementApp')

  .directive('casesView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/cases/cases.html',
      controller: 'CasesController'
    }
  })

  .controller('CasesController', function($scope, $http) {
    $scope.cases = []

    $http
      .get('/_acp/cases')
      .then(resp => {
        $scope.cases = resp.data
      })
  })
