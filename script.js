const Miner = require('./miner')
const consts = require('./constants')
const bitcoinjs = require('bitcoinjs-lib')
const Block = bitcoinjs.Block


const sleep = ms => new Promise(r => setTimeout(r,ms))

const main = async () => {
    
  const resetMiner = async () => {
    
    let prevHash = Buffer.alloc(32, 0)
    let bits = 0x1e7fffff
    let height = 0
    let address = '1NtX9E48dCfnSKN3amMZ84Torggkjj3ovN'

    miner = new Miner(prevHash, bits, height, address)
    
  }

  await resetMiner()
  let lastTime, newTime

  for(let i=0;i<=40;i++){
    if (miner.height > 0 && miner.height % 5 === 0) {
      miner.block.bits = getNewTarget(lastTime, newTime, miner.block.bits,5)
      miner.target = Block.calculateTarget(miner.block.bits)
    }
    if (miner.height == 0 || miner.height % 5 === 4) {
      lastTime = newTime
      newTime = miner.block.timestamp
    }
    let result = await miner.mine(1e6)
    if (result.success) {
      console.log('Mining success!! + ' + miner.block.getId())
      console.log('----------------------')
      await sleep(100)
      miner.block.prevHash = miner.block.getHash()
      miner.height = i + 1
    }
  }
   
  
}

const getNewTarget = (lastTime, newTime, requiredTarget, retargetPeriod) => {

  retargetPeriod = retargetPeriod || consts.RETARGET_PERIOD

  let timeDiffSeconds = newTime - lastTime

  
  let delta = timeDiffSeconds / (retargetPeriod * consts.BLOCK_TIME)
  if (delta > consts.MAX_RETARGET) delta = consts.MAX_RETARGET
  if (delta < (1 / consts.MAX_RETARGET)) delta = (1 / consts.MAX_RETARGET)

  let targetValue = (requiredTarget & 0xffffff)
  let targetExponent = requiredTarget >> 24
  targetValue = Math.floor(targetValue * delta)

  
  while (!(targetValue & 0xff8000)) {
    targetExponent--
    targetValue *= 0x100
  }
  while (targetValue > 0x7fffff) {
    targetExponent++
    targetValue = Math.floor(targetValue / 0x100)
  }
  return (targetExponent << 24) | (targetValue & 0xffffff)
}


main().catch(console.error)


