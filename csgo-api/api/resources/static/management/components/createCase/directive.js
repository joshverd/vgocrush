
angular

  .module('ManagementApp')

  .directive('createCaseView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/createCase/createCase.html',
      controller: 'CreateCaseController'
    }
  })

  .controller('CreateCaseController', function($scope, $element, $http, $state, $stateParams) {
    $scope.editMode = !!$stateParams.id
    $scope.details = {
      name: '',
      price: 0,
      free: false
    }

    $scope.items = []

    $scope.styles = []
    $scope.selectedStyle = {}
    $scope.busy = false

    $scope.determinePrice = function() {
      $http
        .post('/_acp/items/autoPrice', {
          items: $scope.items.map(function(item) {
            return {
              wears: item.wears,
              name: item.item.originalObject.name,
              odds: parseFloat(item.odds)
            }
          })
        })

        .then(function(response) {
          $scope.details.price = response.data.price
          $scope.busy = false
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

    $scope.save = function() {
      $scope.busy = true

      $http
        .post('/_acp/cases/create', {
          id: $scope.details.id || null,
          name: $scope.details.name,
          price: $scope.details.price,
          style: $scope.selectedStyle.id,
          free: $scope.details.free,
          disabled: $scope.details.disabled,
          items: $scope.items.map(function(item) {

            if(item.type === 'cash') {
              return {
                name: 'Money',
                type: 'cash',
                odds: parseFloat(item.odds),
                prize: parseFloat(item.prize)
              }
            }

            return {
              wears: item.wears,
              name: item.item.originalObject.name,
              odds: parseFloat(item.odds)
            }
          })
        })

        .then(function() {
          $scope.busy = false

          if(!$scope.editMode) {
            $state.go('cases')
          }

          UIkit.notification({
              message: `Case ${$scope.details.name} has been ${$scope.editMode ? 'updated' : 'created'}!`,
              status: 'success',
              timeout: 5000
          });
        })

        .catch(function(error) {
          $scope.busy = false

          UIkit.notification({
            message: error.data.error,
            status: 'danger',
            timeout: 5000
          })
        })
    }

    $scope.delete = function() {
      $scope.busy = true

      $http
        .post('/_acp/cases/delete', {
          id: $scope.details.id
        })

        .then(function() {

          if($scope.details.playerId) {
            $state.go('player', {
              id: $scope.details.playerId
            })
          } else {
            $state.go('cases')
          }

          UIkit.notification({
              message: `Case ${$scope.details.name} has been deleted!`,
              status: 'success',
              timeout: 5000
          });
        })

        .catch(function(error) {
          $scope.busy = false

          UIkit.notification({
            message: error.data.error,
            status: 'danger',
            timeout: 5000
          })
        })
    }

    $scope.addItem = function() {
      $scope.items.push({
        item: null,
        odds: 0
      })
    }

    $scope.addCash = function() {
      $scope.items.push({
        type: 'cash',
        prize: 0,
        name: 'Money',
        odds: 0
      })
    }

    $scope.deleteItem = function(index) {
      $scope.items.splice(index, 1)
    }

    $scope.$watch('selectedStyle', function() {
      if($scope.selectedStyle) {
        const style = $scope.styles.filter(function(style) {
          return style.id === $scope.selectedStyle.id
        })

        if(style.length && $scope.selectedStyle.image !== style[0].image) {
          $scope.selectedStyle.image = style[0].image
        }
      }
    }, true)

    $http
      .get('/_acp/cases/styles')
      .then(resp => {
        var styles = resp.data
        $scope.styles = styles

        if(styles.length) {
          $scope.selectedStyle.id = styles[0].id
        }
      })

    if($scope.editMode) {
      $scope.busy = true

      $http
        .get('/_acp/cases/get/' + $stateParams.id)
        .then(resp => {
          var c = resp.data
          $scope.busy = false
          $scope.details = c

          $scope.selectedStyle = {
            id: c.caseStyle
          }

          $scope.items = c.items.map(function(item) {
            if(item.type === 'cash') {
              return {
                type: item.type,
                name: item.name,
                prize: item.prize,
                odds: (item.prob.high - item.prob.low) / 1000
              }
            }

            return {
              name: item.name,
              cleanName: item.cleanName,
              wears: item.wears,
              item: {
                title: item.name,
                image: item.icon,
                originalObject: item
              },
              odds: (item.prob.high - item.prob.low) / 1000
            }
          })
        })
    }
  })
