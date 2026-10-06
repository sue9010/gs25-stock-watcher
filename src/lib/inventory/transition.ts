export type StockEventType="initial"|"restocked"|"changed"|"sold_out";
export type StockTransition={eventType:StockEventType;shouldNotify:boolean}|null;
export function detectStockTransition(previous:number|null,current:number,notifyInitial=false):StockTransition{
  if(previous===null)return{eventType:"initial",shouldNotify:notifyInitial&&current>0};
  if(previous===current)return null;
  if(previous===0&&current>0)return{eventType:"restocked",shouldNotify:true};
  if(previous>0&&current===0)return{eventType:"sold_out",shouldNotify:false};
  if(previous>0&&current>0)return{eventType:"changed",shouldNotify:false};
  return null;
}
