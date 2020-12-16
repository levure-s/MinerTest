const crypto = require('crypto')
const bitcoinjs = require('bitcoinjs-lib')
const Block = bitcoinjs.Block
const Transaction = bitcoinjs.Transaction
const consts = require('./constants')


class Miner {
  constructor(prevHash, bits, height, address) {
    this.block = new Block()
    this.block.prevHash = prevHash
    this.block.bits = bits
    this.block.timestamp = Math.floor(new Date().getTime() / 1000)
    this.address = address
    this.height = height
    this.fees = 0
    this.reward = Miner.getMiningReward(height)
    this.target = Block.calculateTarget(this.block.bits)

    let coinbaseTx = this.makeCoinbase()

    this.block.transactions = [coinbaseTx]
    this.block.merkleRoot = Block.calculateMerkleRoot(this.block.transactions)
  }

  static getMiningReward(thisBlockIndex) {
    let halvings = Math.floor(thisBlockIndex / consts.REWARD_HALVING_PERIOD)
    let reward = consts.INITIAL_MINING_REWARD
    while (halvings-- > 0) {
      reward = Math.floor(reward / 2)
    }
    return reward
  }

  makeCoinbase(satoshiFees) {
    satoshiFees = satoshiFees || 0

    let coinbaseTx = new Transaction()

    let p2pkhScript = bitcoinjs.payments.p2pkh({ address: this.address }).output

    // Coinbase取引にてブロックの高さ埋め込まないと同じTXIDが存在し得る
    let heightHex = this.height.toString(16)
    if (heightHex.length % 2 !== 0) heightHex = '0' + heightHex
    let heightBuf = Buffer.from(heightHex, 'hex').reverse()
    let scriptSig = Buffer.alloc(heightBuf.length + 1, 0)
    scriptSig.writeUInt8(heightBuf.length, 0)
    heightBuf.copy(scriptSig, 1)

    coinbaseTx.addInput(Buffer.alloc(32, 0), 0xffffffff, 0xffffffff, scriptSig)
    coinbaseTx.addOutput(p2pkhScript, this.reward + satoshiFees)
    return coinbaseTx
  }

  addTransaction(tx, fees) {
    this.block.transactions.push(tx)
    if (fees) {
      this.fees += fees
      this.block.transactions[0] = this.makeCoinbase(this.fees)
    }
    this.block.merkleRoot = Block.calculateMerkleRoot(this.block.transactions)
    this.block.nonce = 0
    this.block.timestamp = Math.floor(new Date().getTime() / 1000)
  }

  addTransactions(txs, fees) {
    this.block.transactions = this.block.transactions.concat(txs)
    if (fees) {
      this.fees += fees
      this.block.transactions[0] = this.makeCoinbase(this.fees)
    }
    this.block.merkleRoot = Block.calculateMerkleRoot(this.block.transactions)
    this.block.nonce = 0
    this.block.timestamp = Math.floor(new Date().getTime() / 1000)
  }

  mine(count) {
    return new Promise((resolve, reject) => {
      let firstNonce = this.block.nonce
      let startTime = new Date().getTime()
      let blockHeader = this.block.toBuffer(true) // headersOnly
      for (var i = 0; i < count; i++) {
        // 4 バイトで書き込める値を上回ったので、nonce = 0、timestampを更新
        if (firstNonce + i >= Math.pow(2, 32)) {
          firstNonce = -1 * i
          let timeSeconds = Math.floor(new Date().getTime() / 1000)
          blockHeader.writeUInt32LE(timeSeconds, 68)
          this.block.timestamp = timeSeconds
        }

        // nonce 進める
        this.block.nonce = firstNonce + i
        blockHeader.writeUInt32LE(firstNonce + i, 76)

        // ハッシュ掛ける
        let hashResult = dsha256(blockHeader)
        if (this.target.compare(hashResult.reverse()) >= 0) {
          let timeEnd = new Date().getTime()
          console.log('Height: ' + this.height)
          console.log('bits: ' + this.block.bits.toString(16))
          console.log('Mining Finished after ' + (timeEnd - startTime) + ' ms')
          console.log('Mining Finished after ' + (i+1) + ' iterations')
          return resolve({
            success: true,
            result: blockHeader
          })
        }
      }
      this.block.nonce++
      return resolve({
        success: false,
        result: null
      })
    })
  }
}

const dsha256 = data => crypto.createHash('sha256').update(crypto.createHash('sha256').update(data).digest()).digest()


module.exports = Miner
