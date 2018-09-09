
import r from 'lib/database'
import { amqpChannel } from 'lib/amqp'

const PurchaseOrder = r.table('PurchaseOrder')
export default PurchaseOrder

export function createPurchaseOrder(provider, itemNames, options = {}) {
  const purchaseOrder = {
    ...options,
    
    provider,
    itemNames,

    createdAt: r.now(),
    state: 'QUEUED'
  }

  return PurchaseOrder
    .insert(purchaseOrder, { returnChanges: true })
    .then(({ changes }) => {
      const purchaseOrder = changes[0].new_val

      amqpChannel().publish('skne.order', provider, new Buffer(purchaseOrder.id), {
        persistent: true
      })

      return purchaseOrder
    })
}
