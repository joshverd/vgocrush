
angular

  .module('ManagementApp')

  .directive('promotionsView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/promotions/promotions.html',
      controller: 'PromotionsViewController'
    }
  })

  .controller('PromotionsViewController', function($scope, $stateParams, $http) {
    $scope.details = {}
    $scope.promotions = []
    $scope.busy = false

    $scope.refresh = function() {
      $scope.promotions = []
      $scope.busy = true

      $http.get('/_acp/promotions').then(function(response) {
        $scope.promotions = response.data
        $scope.busy = false
      })
    }

    $scope.generateRandom = function() {
      $scope.details.code = Math.random().toString(36).slice(2, 7).toUpperCase()
    }

    $scope.submit = function() {
      $scope.busy = true

      $http
        .post('/_acp/createPromo', $scope.details)
        .then(function() {
          $scope.busy = false
          $scope.details = {}
          $scope.generateRandom()
          UIkit.switcher('#switcher')[0].show(0)
          UIkit.tab('#tab')[0].show()
          $scope.refresh()
        })

        .catch(function(error) {
          $scope.busy = false

          UIkit.notification({
            message: error.data,
            status: 'danger',
            timeout: 5000
          })
        })
    }

    $scope.generateRandom()
    $scope.refresh()
  })
