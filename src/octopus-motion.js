import config from './octopus-config.json' with { type: 'json' };

export const OCTOPUS_CONFIG=config;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const p=clamp(x);return p*p*(3-2*p);};

export function octopusPressure(t,mode,explode=0,weights=null) {
  const activity=1-smooth(explode),pulse=.5+.5*Math.sin(t*4.8);
  const jet=(weights?.jet??(mode==='jet'?1:0))*activity;
  const swim=(weights?.swim??(mode==='swim'?1:0))*activity;
  return 17+activity*2*Math.sin(t*.9)+jet*(11+7*pulse)+swim*5;
}

export function octopusPose(t,mode,explode=0,weights=null) {
  const activity=1-smooth(explode);
  const weight=name=>(weights?.[name]??(mode===name?1:0))*activity;
  const swim=weight('swim'),coil=weight('coil'),jet=weight('jet'),mantle=weight('mantle');
  const pulse=.5+.5*Math.sin(t*4.8);
  const arms=Array.from({length:config.armCount},(_,i)=>{
    const phase=t*.85+i*.79;
    const angles=config.restAngles.map((angle,j)=>angle
      +Math.sin(i*.9)*.025*(j>4?1:0)
      +activity*.025*Math.sin(phase-j*.28)
      +swim*.12*Math.sin(t*2.1-j*.42+i*.65)
      +coil*.25*(j/(config.segmentLengths.length-1))**1.2);
    const curl=angles.reduce((n,a)=>n+Math.max(0,a),0);
    return {id:i,angles,yaw:activity*.045*Math.sin(phase*.7),curl,angle:angles[4],load:Math.round(32+curl*10+jet*pulse*12),contact:false};
  });
  const pressure=octopusPressure(t,mode,explode,weights);
  const thrust=5.8+jet*(9+5*pulse)+swim*3;
  return {time:t,mode,explode,arms,legs:arms,mantleOpen:mantle*.96,
    pumpAngle:t*(.25+jet*2.4+swim*.65),jetAngle:t*(.6+jet*8),beakOpen:.08+coil*.24,
    pressure,thrust,depth:12.4-.12*Math.sin(t*.45)*activity,
    lift:.08*Math.sin(t*.7)*activity+swim*.18,frequency:jet*1.8+swim*.55,displayFrequency:pressure,
    power:9.4+jet*18+swim*6,wingAngle:0,abdomenOpen:0,flying:false,clawOpen:0,grip:thrust,tailAngle:0,tailFlex:0,
    bodyRoll:activity*.018*Math.sin(t*.63),bodyPitch:activity*.014*Math.sin(t*.49),
  };
}
