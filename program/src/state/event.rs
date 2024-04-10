pub trait Event {
    fn data(&self) -> Vec<u8>;
}

#[repr(u8)]
#[derive(Debug)]
pub enum EventType {
    BuySell,
}

// macro_rules! log_event {
//     ($event:expr) => {{
//         let event = $event.data();
//         log::log(ctx, &event)
//     }};
//     () => {};
// }
