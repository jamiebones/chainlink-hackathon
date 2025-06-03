import { BigInt } from "@graphprotocol/graph-ts"
import {
    Contract,
    ExampleEvent
} from "../generated/Contract/Contract"
import { ExampleEntity } from "../generated/schema"

export function handleExampleEvent(event: ExampleEvent): void {
    // Entities can be loaded from the store using a string ID; this ID
    // needs to be unique across all entities of the same type
    let entity = ExampleEntity.load(event.transaction.hash.concatI32(event.logIndex.toI32()))

    // Entities only exist after they have been saved to the store;
    // `null` checks allow to create entities on demand
    if (!entity) {
        entity = new ExampleEntity(event.transaction.hash.concatI32(event.logIndex.toI32()))

        // Entity fields can be set using simple assignments
        entity.count = BigInt.fromI32(0)
    }

    // BigInt and BigDecimal math are supported
    entity.count = entity.count + BigInt.fromI32(1)

    // Entity fields can be set based on event parameters
    entity.user = event.params.user
    entity.blockNumber = event.block.number
    entity.blockTimestamp = event.block.timestamp
    entity.transactionHash = event.transaction.hash

    // Entities can be written to the store with `.save()`
    entity.save()
} 