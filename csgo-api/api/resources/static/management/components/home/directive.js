
angular

  .module('ManagementApp')

  .directive('homeView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/home/home.html',
      controller: 'HomeController'
    }
  })

  .controller('HomeController', function($scope, $element, $http, $state, $stateParams) {
    $scope.items = []
    $scope.busy = true

    $scope.refresh = function(update) {
      $scope.busy = true

      $http
        .get('/_acp/stock' + (update ? '?update=1' : ''))
        .then(resp => {
          $scope.lastUpdated = resp.data.lastUpdated
          $scope.items = resp.data.items
          $scope.lowItems = resp.data.lowItems
          $scope.busy = false
        })
    }

    $scope.refresh()

    $scope.showPlayers = function(e, item) {
      e.preventDefault()
      
      $http
        .get('/_acp/stock/owners/' + item.name)
        .then(response => {
          UIkit.modal.alert('<h3>'
            + item.name + '</h3>'
            + '<ul>'
            + response
              .data
              .map(p => '<li><a target="_blank" href="/_acp#!/player/' + p.id + '">' + p.displayName + '</a> (' + p.id + ')</li>')
              .join('')
            + '</ul>')
        })
    }

    $scope.stock = function(item) {
      UIkit.modal
        .prompt(`How many purchases of <b>${item.name}</b>? ($${item.price.toFixed(2)} each)`, item.demand)
        .then(amount => {
          if(!amount) {
            return
          }

          amount = parseInt(amount)
          if(amount <= 0) {
            return
          }

          UIkit.notification({
            message: 'Attempting to restock ' + item.name + '... please wait',
            status: 'success',
            timeout: 60000
          })

          $http

            .post('/_acp/stock/restock', {
              amount,
              itemName: item.name
            })

            .then(response => {

              UIkit.notification({
                message: `Items have been purchased will be deposited into storage bots soon`,
                status: 'success',
                timeout: 25000
              })

            }, response => {
              UIkit.notification({
                message: response.data.error,
                status: 'danger',
                timeout: 5000
              })
            })
        })
    }
  })
