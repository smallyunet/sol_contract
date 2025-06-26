use anchor_lang::prelude::*;

declare_id!("3Zbdw1oWu1CiMiQr3moQeT4XzMgeqmCvjH5R5wroDWQH");

#[program]
pub mod hello_sol {
    use super::*;

    pub fn say_hello(ctx: Context<Hello>) -> Result<()> {
        msg!("Hello, world!");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Hello {}
