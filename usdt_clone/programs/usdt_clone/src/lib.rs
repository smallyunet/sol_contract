use anchor_lang::prelude::*;

declare_id!("CFmGdHuqDymqJYBX44fyNjrFoJx6wRkZPkYgZqfkAQvT");

#[account]
pub struct Mint {
    pub decimals: u8,
    pub mint_authority: Pubkey,
}

#[account]
pub struct TokenAccount {
    pub owner: Pubkey,
    pub balance: u64,
}

#[program]
pub mod usdt_clone {
    use super::*;

    pub fn init_mint(ctx: Context<InitMint>, decimals: u8) -> Result<()> {
        let mint = &mut ctx.accounts.mint;
        mint.decimals = decimals;
        mint.mint_authority = ctx.accounts.authority.key();
        Ok(())
    }
    
    pub fn init_token_account(ctx: Context<InitTokenAccount>) -> Result<()> {
        let token = &mut ctx.accounts.token;
        token.owner = ctx.accounts.owner.key();
        token.balance = 1000;
        Ok(())
    }

    pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
        let from = &mut ctx.accounts.from;
        let to   = &mut ctx.accounts.to;

        require!(from.balance >= amount, ErrorCode::InsufficientFunds);

        from.balance -= amount;
        to.balance = to
            .balance
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitMint<'info> {
    #[account(
        init, 
        payer = authority,
        space = 8 + 1 + 32
    )]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitTokenAccount<'info> {
    #[account(init, payer = owner, space = 8 + 32 + 8)]
    pub token: Account<'info, TokenAccount>,
    #[account(mut, signer)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(mut, has_one = owner)]
    pub from: Account<'info, TokenAccount>,
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    #[account(signer)]
    pub owner: Signer<'info>,
}

#[error_code]
pub enum ErrorCode {
    InsufficientFunds,
    ArithmeticOverflow,
}