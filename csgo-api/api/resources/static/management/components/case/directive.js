
angular

  .module('ManagementApp')

  .directive('caseView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/createCase/createCase.html',
      controller: 'CreateCaseController'
    }
  })
