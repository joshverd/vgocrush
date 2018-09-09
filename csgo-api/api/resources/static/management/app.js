
angular

  .module('ManagementApp', [
    'ui.router',
    'angucomplete-alt'
  ])

  .constant('locals', window.locals)

  .config(function($stateProvider, $urlRouterProvider, locals) {
      $urlRouterProvider.otherwise(locals.admin ? '/stats' : '/players');

      $stateProvider

          .state('case', {
              url: '/case/:id?playerId',
              template: '<create-case-view></create-case-view>'
          })

          .state('cases', {
              url: '/cases',
              template: '<cases-view></cases-view>'
          })

          .state('createCase', {
              url: '/create-case',
              template: '<create-case-view></create-case-view>'
          })

          .state('caseCreatorList', {
              url: '/create-creator-list',
              template: '<case-creator-list-view></case-creator-list-view>'
          })

          .state('storage', {
              url: '/storage',
              template: '<storage-view></storage-view>'
          })

          .state('players', {
              url: '/players',
              template: '<players-view></players-view>'
          })

          .state('playerWinners', {
              url: '/playerWins',
              template: '<player-big-wins></player-big-wins>'
          })

          .state('playerDeposits', {
              url: '/deposits',
              template: '<player-deposits></player-deposits>'
          })

          .state('playerWithdraws', {
              url: '/withdraws',
              template: '<player-withdraws></player-withdraws>'
          })

          .state('player', {
              url: '/player/:id',
              template: '<player-view></player-view>'
          })

          .state('settings', {
              url: '/settings',
              template: '<settings-view></settings-view>'
          })

          .state('promotions', {
              url: '/promotions',
              template: '<promotions-view></promotions-view>'
          })

          .state('stats', {
              url: '/stats',
              template: '<stats-view></stats-view>'
          })

  })

  .run(function($rootScope, locals) {
    $rootScope.locals = locals
  })
