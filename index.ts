import { Client, TextChannel, Snowflake, Message, Collection, GuildMember } from 'discord.js';
import * as config from './config.json';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const client = new Client({
    partials: [ "MESSAGE" ],
    fetchAllMembers: true
});

let channel: TextChannel = null;
let initialMessageID: Snowflake = null;

const content = 
`**Type the number of the problem you're experiencing and I'll do my best to help you!**

\`1\` - I want to setup the bot (join/leave messages, prefix, etc...)
\`2\` - I want to use the web dashboard
\`3\` - I want to know how to use the bot
\`4\` - ManageInvite says my server needs to be upgraded
\`5\` - My problem is not in the list`;

const hasLeftWarningMessage = ':warning: Le membre qui a ouvert le ticket vient de quitter le serveur, le ticket peut donc probablement être fermé !';
const ticketToolID = '557628352828014614';
const usersTicketChannels = new Collection<Snowflake, Snowflake>();

client.on('ready', async () => {
    console.log(`Ready. Logged as ${client.user.tag}.`);
    channel = client.channels.cache.get(config.supportChannel) as TextChannel;
    channel.messages.fetch().then(async (messages) => {
        initialMessageID = messages.last()?.id;
        if(!initialMessageID){
            initialMessageID = (await channel.send(content)).id;
        }
        setInterval(() => {
            channel.messages.fetch().then((fetchedMessages) => {
                const messagesToDelete = fetchedMessages.filter((m) => (Date.now() - m.createdTimestamp) > 60000 && m.id !== initialMessageID);
                channel.bulkDelete(messagesToDelete);
            });
        }, 10000);
    });
    const ticketsNotResolved: TextChannel[] = [];
    for(const ticketChannelID of channel.guild.channels.cache.filter((channel) => channel.name.includes('ticket-') && channel.type === 'text').map((channel) => channel.id)){
        const ticketChannel = client.channels.cache.get(ticketChannelID) as TextChannel;
        const messages = await ticketChannel.messages.fetch();
        const creationMessage = messages.find((message) => message.author.id === ticketToolID && message.embeds.length > 0 && message.content && message.content.includes('Welcome'));
        const userID = creationMessage?.mentions.users.first().id;
        const hasLeft = !ticketChannel.guild.members.cache.has(userID);
        if(creationMessage && userID){
            usersTicketChannels.set(userID, ticketChannelID);
        } else {
            ticketsNotResolved.push(ticketChannel);
        }
        if(hasLeft && !messages.some((message) => message.content === hasLeftWarningMessage)){
            client.emit('guildMemberRemove', { id: userID } as GuildMember);
        }
    }
    console.log(`\n${usersTicketChannels.size} ticket channels resolved. (missing ${ticketsNotResolved.map((channel) => `#${channel.name}`).join(' | ')})`);
});

interface MessageData {
    messageID: Snowflake;
    timeout: any;
}
const relatedMessages: Collection<Snowflake, MessageData> = new Collection();

const sendAndDeleteAfter = (message: Message, content: string) => {
    message.channel.send(content).then((m) => {
        const timeout = setTimeout(() => {
            relatedMessages.delete(message.id);
            message.delete();
            m.delete();
        }, 60000);
        relatedMessages.set(message.id, {
            messageID: m.id,
            timeout
        });
    });
};

client.on('messageDelete', (message) => {
    const relatedMessageData = relatedMessages.get(message.id);
    if(relatedMessageData){
        channel.messages.fetch(relatedMessageData.messageID).then((m) => {
            m.delete();
            clearTimeout(relatedMessageData.timeout);
            relatedMessages.delete(message.id);
        });
    }
})

client.on('message', (message) => {
    if(message.partial) return;
    if(message.author.bot) return;
    if(message.channel.id === config.supportChannel){
        switch(message.content){
            case "1":
                sendAndDeleteAfter(
                    message,
                    `Hello ${message.author.toString()}, you can configure join messages, leave messages or join messages in direct messages by using the dashboard: **<https://dash.manage-invite.xyz/>** (recommended) or the \`+configjoin\`, \`+configleave\` and \`+configdmjoin\` commands.`
                );
                break;
            case "2":
                sendAndDeleteAfter(
                    message,
                    `Hello ${message.author.toString()}, you can access the web dashboard by using this link: **<https://dash.manage-invite.xyz>**.`
                );
                break;
            case "3":
                sendAndDeleteAfter(
                    message,
                    `Hello ${message.author.toString()}, to get the list of all the commands, you can run the \`+help\` command.\nYou can also type \`1\` to know how to configure the bot!`
                );
                break;
            case "4":
                sendAndDeleteAfter(
                    message,
                    `Hello ${message.author.toString()}, this is because you didn't buy ManageInvite. Indeed, our services are no longer free, to keep a good speed and uptime for users who really need a stable bot. Nevertheless, we want ManageInvite to remain accessible to all, that's why the price has been lowered from $5 to $2 per month. You want to try the bot? Ask for a 7-day trial period in <#${config.trialTickets}>! It's totally free, just send the link to your server.`,
                );
                break;
            case "5":
                (client.channels.cache.get(config.contactChannel) as TextChannel).updateOverwrite(message.author, {
                    VIEW_CHANNEL: true
                });
                sendAndDeleteAfter(
                    message,
                    `Hello ${message.author.toString()}, you now have access to the <#${config.contactChannel}> channel. You can click the :envelope: reaction to open a ticket!`
                );
                break;
            default:
                sendAndDeleteAfter(
                    message,
                    `Hello, ${message.author.toString()}, you must type a valid number corresponding to the issue you are experiencing.`
                );
        }
    } else if(
        (/(discord\.(gg|io|me|li)\/.+|(discord|discordapp)\.com\/invite\/.+)/i.test(message.content))
        && !((message.channel as TextChannel).name.startsWith("ticket-"))
        && !(message.member.hasPermission("MANAGE_MESSAGES"))
    ){
        message.delete();
        message.reply("you are not able to send server invites.").then((m) => {
            m.delete({
                timeout: 5000
            });
        });
    }
});

client.on('channelCreate', async (channel) => {
    if(channel.type !== 'text') return;
    const createdChannel = channel as TextChannel;
    if(!createdChannel.name.includes('ticket-')) return;
    await delay(5000);
    const creationMessage = createdChannel.messages.cache.find((message) => message.author.id === ticketToolID && message.embeds.length > 0 && message.content && message.content.includes('Welcome'));
    const userID = creationMessage?.mentions.users.first().id;
    const hasLeft = !createdChannel.guild.members.cache.has(userID);
    if(creationMessage && userID){
        usersTicketChannels.set(userID, createdChannel.id);
    }
    if(hasLeft && !createdChannel.messages.cache.some((message) => message.content === hasLeftWarningMessage)){
        client.emit('guildMemberRemove', { id: userID } as GuildMember);
    }
});

client.on('channelDelete', (channel) => {
    const userID = usersTicketChannels.findKey((channelID) => channelID === channel.id);
    if(userID){
        usersTicketChannels.delete(userID);
    }
});

client.on('guildMemberRemove', async (member) => {
    const ticketChannelID = usersTicketChannels.get(member.id);
    const ticketChannel = client.channels.cache.get(ticketChannelID) as TextChannel;
    if(ticketChannel){
        ticketChannel.send(hasLeftWarningMessage);
    }
});

client.login(config.token);
