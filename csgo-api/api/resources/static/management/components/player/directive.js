
angular

  .module('ManagementApp')

  .directive('playerView', function() {
    return {
      restrict: 'E',
      templateUrl: 'management/components/player/player.html',
      controller: 'PlayerViewController'
    }
  })

  .controller('PlayerViewController', function($scope, $stateParams, $http) {
    $scope.loading = true
    $scope.player = null

    $scope.items = []
    $scope.campaigns = []
    $scope.balanceHistory = []
    $scope.adminBalanceHistory = []

    $scope.itemTab = {
      item: null
    }

    function updateUser(update) {

    }

    $scope.toggleItemState = function(item) {
      $http.post('/_acp/players/toggleItem/' + $stateParams.id, {
        id: item
      })

      .then(() => {
        $scope.refresh()

        UIkit.notification({
          message: 'Successfully toggled item state',
          status: 'success',
          timeout: 5000
        })
      })
    }

    $scope.$watchCollection('player', function(newVal, oldVal) {
      if(!oldVal) {
        return
      }

      const update = {}

      if(newVal.lockWithdraws !== oldVal.lockWithdraws) {
        update.lockWithdraws = newVal.lockWithdraws
      }

      if(newVal.disableOpeningCase !== oldVal.disableOpeningCase) {
        update.disableOpeningCase = newVal.disableOpeningCase
      }

      if(newVal.lockDeposits !== oldVal.lockDeposits) {
        update.lockDeposits = newVal.lockDeposits
      }

      if(newVal.banned !== oldVal.banned) {
        update.banned = newVal.banned
      }

      if(newVal.muted !== oldVal.muted) {
        update.muted = newVal.muted

        if(newVal.muted) {
          update.muteExpiration = newVal.muteExpiration
        }
      }

      if(Object.keys(update).length) {
        $http.post('/_acp/players/update/' + $stateParams.id, update).then(() => {
          UIkit.notification({
            message: 'Player successfully updated',
            status: 'success',
            timeout: 5000
          })
        })
      }
    }, true)

    $scope.giveBalance = function() {
      UIkit.modal.prompt('How much to add to balance?', '1.00').then(function(amount) {
        if(!amount) {
          return
        }

        $http.post('/_acp/players/update/' + $stateParams.id, {
          _addBalance: parseFloat(amount)
        }).then(() => {
          $scope.refresh()

          UIkit.notification({
            message: 'Successfully gave player money',
            status: 'success',
            timeout: 5000
          })
        }, err => {
          UIkit.notification({
            message: err.data.error,
            status: 'danger',
            timeout: 5000
          })
        })
      })
    }

    $scope.removeBalance = function() {
      UIkit.modal.prompt('How much to remove from balance?', '1.00').then(function(amount) {
        if(!amount) {
          return
        }

        $http.post('/_acp/players/update/' + $stateParams.id, {
          _removeBalance: parseFloat(amount)
        }).then(() => {
          $scope.refresh()

          UIkit.notification({
            message: 'Successfully removed player\'s money',
            status: 'success',
            timeout: 5000
          })
        })
      })
    }

    $scope.bypassWithdrawal = function() {

        $http.post('/_acp/players/update/' + $stateParams.id, {
          totalDeposit: 2
        }).then(() => {
          $scope.refresh()

          UIkit.notification({
            message: 'Successfully Bypassed Withdrawal Limit',
            status: 'success',
            timeout: 5000
          })
        })
    }

    $scope.removeItem = function(id) {
      $http.post('/_acp/players/removeItem/' + $stateParams.id, {
        id: id
      })

      .then(() => {
        $scope.items = $scope.items.filter(function(item) {
          return item.id !== id
        })

        UIkit.notification({
          message: 'Successfully removed item from inventory',
          status: 'success',
          timeout: 5000
        })
      })
    }

    $scope.togglePair = function(state) {
      $http.post('/_acp/players/togglePair/' + $stateParams.id, {
        state: state
      })

      .then(() => {
        UIkit.notification({
          message: 'Successfully toggled pair',
          status: 'success',
          timeout: 5000
        })
      })
    }

    $scope.addItem = function() {
      $http.post('/_acp/players/addItem/' + $stateParams.id, {
        name: $scope.itemTab.item.title
      })

      .then(() => {
        $scope.refresh()

        UIkit.notification({
          message: 'Successfully added item to inventory',
          status: 'success',
          timeout: 5000
        })
      })

      $scope.itemTab.item = null
    }

    $scope.deleteCampaign = function(id) {
      $http
        .post('/_acp/players/campaign/' + id + '/delete')
        .then(() => {
          $scope.refresh()

          UIkit.notification({
            message: 'Successfully deleted campaign',
            status: 'success',
            timeout: 5000
          })
        })
    }

    $scope.clearCampaignBalance = function(id) {
      $http
        .post('/_acp/players/campaign/' + id + '/clear')
        .then(() => {
          $scope.refresh()

          UIkit.notification({
            message: 'Successfully cleared campaign balance',
            status: 'success',
            timeout: 5000
          })
        })
    }

    $scope.addCampaignBalance = function(id) {
      UIkit.modal.prompt('How much to add to balance?', '1.00').then(function(amount) {
        if(!amount) {
          return
        }

        $http.post('/_acp/players/campaign/' + id + '/add', {
          balance: parseFloat(amount)
        }).then(() => {
          $scope.refresh()

          UIkit.notification({
            message: 'Successfully added to campaign balance',
            status: 'success',
            timeout: 5000
          })
        })
      })
    }

    $scope.removeCampaignBalance = function(id) {
      UIkit.modal.prompt('How much to remove from balance?', '1.00').then(function(amount) {
        if(!amount) {
          return
        }

        $http.post('/_acp/players/campaign/' + id + '/remove', {
          balance: parseFloat(amount)
        }).then(() => {
          $scope.refresh()

          UIkit.notification({
            message: 'Successfully added to campaign balance',
            status: 'success',
            timeout: 5000
          })
        })
      })
    }

    $scope.changeCampaignCode = function(id, name) {
      UIkit.modal.prompt('What to change the code to?', name).then(function(name) {
        if(!name) {
          return
        }

        $http.post('/_acp/players/campaign/' + id + '/code', {
          name: name
        }).then(() => {
          setTimeout(function(){
            $scope.refresh()
          },1200)

          UIkit.notification({
            message: 'Successfully changed campaign code',
            status: 'success',
            timeout: 5000
          })
        }, resp => {
          UIkit.notification({
            message: resp.data.error,
            status: 'danger',
            timeout: 5000
          })
        })
      })
    }

    $scope.changeCampaignReward = function(id, reward) {
      UIkit.modal.prompt('Set reward to:', reward).then(function(reward) {
        if(!reward) {
          return
        }

        $http.post('/_acp/players/campaign/' + id + '/reward', {
          amount: parseFloat(reward)
        }).then(() => {
          $scope.refresh()

          UIkit.notification({
            message: 'Successfully changed campaign reward',
            status: 'success',
            timeout: 5000
          })
        }, resp => {
          UIkit.notification({
            message: resp.data.error,
            status: 'danger',
            timeout: 5000
          })
        })
      })
    }

    $scope.mute = function() {
      if(!$scope.player.muted) {
        UIkit.modal.prompt('How many hours to mute for?', '1').then(function(hours) {
          if(!hours) {
            return
          }

          hours = parseInt(hours)
          if(hours <= 0) {
            return
          }

          $scope.player.muted = true
          $scope.player.muteExpiration = new Date(Date.now() + ((3600 * hours) * 1000))
          $scope.$apply()
        })
      } else {
        $scope.player.muted = false
      }
    }

    $scope.refresh = function() {
      $http
        .get('/_acp/players/' + $stateParams.id)
        .then(resp => {
          if(resp.data.player) {
            $scope.items = resp.data.player.items
            $scope.campaigns = resp.data.player.campaigns
            $scope.adminBalanceHistory = resp.data.player.adminBalanceHistory
            $scope.balanceHistory = resp.data.player.balanceHistory.map(function(h, i, a) {
              if(i === 0) {
                return Object.assign(h, {
                  _oldBalance: 0,
                  _newBalance: h.balance
                })
              }

              return Object.assign(h, {
                _oldBalance: a[i - 1]._newBalance,
                _newBalance: a[i - 1]._newBalance + h.balance
              })
            })

            delete resp.data.player.items
            delete resp.data.player.campaigns
            delete resp.data.player.balanceHistory
            delete resp.data.player.adminBalanceHistory
            $scope.player = resp.data.player
          } else {
            $scope.error = 'Cannot find user'
          }

          $scope.loading = false
        })
    }

    $scope.refresh()
  })
