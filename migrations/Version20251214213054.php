<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251214213054 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE subscriptions ADD user_id INT NOT NULL, ADD sub_user_id_id INT NOT NULL');
        $this->addSql('ALTER TABLE subscriptions ADD CONSTRAINT FK_4778A01A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
        $this->addSql('ALTER TABLE subscriptions ADD CONSTRAINT FK_4778A01B14DF6C2 FOREIGN KEY (sub_user_id_id) REFERENCES user (id)');
        $this->addSql('CREATE INDEX IDX_4778A01A76ED395 ON subscriptions (user_id)');
        $this->addSql('CREATE INDEX IDX_4778A01B14DF6C2 ON subscriptions (sub_user_id_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE subscriptions DROP FOREIGN KEY FK_4778A01A76ED395');
        $this->addSql('ALTER TABLE subscriptions DROP FOREIGN KEY FK_4778A01B14DF6C2');
        $this->addSql('DROP INDEX IDX_4778A01A76ED395 ON subscriptions');
        $this->addSql('DROP INDEX IDX_4778A01B14DF6C2 ON subscriptions');
        $this->addSql('ALTER TABLE subscriptions DROP user_id, DROP sub_user_id_id');
    }
}
