<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20251214213448 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE subscriptions DROP FOREIGN KEY FK_4778A01B14DF6C2');
        $this->addSql('DROP INDEX IDX_4778A01B14DF6C2 ON subscriptions');
        $this->addSql('ALTER TABLE subscriptions CHANGE sub_user_id_id sub_user_id INT NOT NULL');
        $this->addSql('ALTER TABLE subscriptions ADD CONSTRAINT FK_4778A01D8B68F61 FOREIGN KEY (sub_user_id) REFERENCES user (id)');
        $this->addSql('CREATE INDEX IDX_4778A01D8B68F61 ON subscriptions (sub_user_id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE subscriptions DROP FOREIGN KEY FK_4778A01D8B68F61');
        $this->addSql('DROP INDEX IDX_4778A01D8B68F61 ON subscriptions');
        $this->addSql('ALTER TABLE subscriptions CHANGE sub_user_id sub_user_id_id INT NOT NULL');
        $this->addSql('ALTER TABLE subscriptions ADD CONSTRAINT FK_4778A01B14DF6C2 FOREIGN KEY (sub_user_id_id) REFERENCES user (id)');
        $this->addSql('CREATE INDEX IDX_4778A01B14DF6C2 ON subscriptions (sub_user_id_id)');
    }
}
